jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}))

jest.mock("./android-sms-module", () => ({
  getSmsPermissionStatus: jest.fn(),
  scanRecentSmsMessages: jest.fn(),
}))

import { createSmsImportFingerprint } from "./fingerprint"
import { scanSmsImportReviewQueue } from "./bootstrap"
import { getSmsPermissionStatus, scanRecentSmsMessages } from "./android-sms-module"
import type { SmsImportRawMessage, SmsImportReviewItem } from "../../types/sms-import"

const mockGetSmsPermissionStatus = getSmsPermissionStatus as jest.MockedFunction<
  typeof getSmsPermissionStatus
>
const mockScanRecentSmsMessages = scanRecentSmsMessages as jest.MockedFunction<
  typeof scanRecentSmsMessages
>

function createMessage(
  overrides: Partial<SmsImportRawMessage> = {}
): SmsImportRawMessage {
  return {
    messageId: "sms-1",
    sender: "VK-HDFCBK",
    body: "INR 499 spent at Amazon Marketplace using debit card",
    receivedAt: "2026-04-11T10:15:30.000Z",
    ...overrides,
  }
}

function createExistingItem(message: SmsImportRawMessage): SmsImportReviewItem {
  const fingerprint = createSmsImportFingerprint(message)

  return {
    id: `${fingerprint}_${message.messageId}`,
    fingerprint,
    sourceMessage: message,
    amount: 499,
    currency: "INR",
    merchantName: "Amazon Marketplace using debit card",
    categorySuggestion: "Shopping",
    paymentMethodSuggestion: { type: "Debit Card" },
    noteSuggestion: "SMS import: Amazon Marketplace using debit card",
    transactionDate: message.receivedAt,
    matchedLocale: "en-IN",
    matchedPatternKey: "india.generic.transaction",
    status: "accepted",
    createdAt: "2026-04-11T10:16:00.000Z",
    updatedAt: "2026-04-11T10:16:00.000Z",
  }
}

describe("scanSmsImportReviewQueue", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns no items when permission is not granted", async () => {
    mockGetSmsPermissionStatus.mockResolvedValue("denied")

    await expect(
      scanSmsImportReviewQueue({
        existingItems: [],
        lastScanCursor: "2026-04-11T09:00:00.000Z",
        bootstrapCompletedAt: null,
      })
    ).resolves.toEqual({
      permissionStatus: "denied",
      createdItems: [],
      nextCursor: "2026-04-11T09:00:00.000Z",
      bootstrapCompletedAt: null,
    })

    expect(mockScanRecentSmsMessages).not.toHaveBeenCalled()
  })

  it("creates new review items, dedupes existing ones, and keeps a non-lossy newest cursor", async () => {
    const existingMessage = createMessage()
    const newerMessage = createMessage({
      messageId: "sms-2",
      body: "INR 250 paid to Uber Trip via credit card",
      receivedAt: "2026-04-11T10:20:00.000Z",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanRecentSmsMessages.mockResolvedValue([existingMessage, newerMessage])

    const result = await scanSmsImportReviewQueue({
      existingItems: [createExistingItem(existingMessage)],
      lastScanCursor: "2026-04-11T10:00:00.000Z",
      bootstrapCompletedAt: null,
    })

    expect(mockScanRecentSmsMessages).toHaveBeenCalledWith({
      since: "2026-04-11T10:00:00.000Z",
      lookbackDays: 7,
      limit: 500,
    })
    expect(result.permissionStatus).toBe("granted")
    expect(result.createdItems).toHaveLength(1)
    expect(result.createdItems[0]).toMatchObject({
      sourceMessage: newerMessage,
      amount: 250,
      paymentMethodSuggestion: { type: "Credit Card" },
      categorySuggestion: "Transport",
      status: "pending",
    })
    expect(result.nextCursor).toBe("2026-04-11T10:19:59.999Z")
    expect(result.bootstrapCompletedAt).not.toBeNull()
  })

  it("preserves the previous cursor when a rescan finds nothing new", async () => {
    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanRecentSmsMessages.mockResolvedValue([])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: "2026-04-11T10:20:00.000Z",
      bootstrapCompletedAt: "2026-04-11T10:30:00.000Z",
    })

    expect(result.nextCursor).toBe("2026-04-11T10:20:00.000Z")
    expect(result.bootstrapCompletedAt).toBe("2026-04-11T10:30:00.000Z")
  })

  it("uses the bounded initial scan window and limit when no cursor exists", async () => {
    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanRecentSmsMessages.mockResolvedValue([])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })

    expect(mockScanRecentSmsMessages).toHaveBeenCalledWith({
      lookbackDays: 7,
      limit: 500,
    })
    expect(result.nextCursor).toBeNull()
  })

  it("keeps the cursor just behind the newest timestamp to avoid missing same-timestamp messages", async () => {
    const firstMessage = createMessage({
      messageId: "sms-1",
      receivedAt: "2026-04-11T10:20:00.000Z",
    })
    const secondMessage = createMessage({
      messageId: "sms-2",
      body: "INR 250 paid to Uber Trip via credit card",
      receivedAt: "2026-04-11T10:20:00.000Z",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanRecentSmsMessages.mockResolvedValue([firstMessage, secondMessage])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })

    expect(result.nextCursor).toBe("2026-04-11T10:19:59.999Z")
  })

  it("dedupes duplicate messages produced within the same scan batch", async () => {
    const firstMessage = createMessage({
      messageId: "sms-1",
      receivedAt: "2026-04-11T10:15:05.000Z",
    })
    const duplicateMessage = createMessage({
      messageId: "sms-2",
      receivedAt: "2026-04-11T10:15:45.000Z",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanRecentSmsMessages.mockResolvedValue([firstMessage, duplicateMessage])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })

    expect(result.createdItems).toHaveLength(1)
    expect(result.createdItems[0]?.sourceMessage.messageId).toBe("sms-1")
  })
})
