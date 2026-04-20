jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}))

jest.mock("./android-sms-module", () => ({
  categorizeSmsImportMessages: jest.fn(),
  getSmsPermissionStatus: jest.fn(),
  scanRecentSmsMessages: jest.fn(),
}))

import { createSmsImportFingerprint } from "./fingerprint"
import { scanSmsImportReviewQueue } from "./bootstrap"
import {
  categorizeSmsImportMessages,
  getSmsPermissionStatus,
  scanRecentSmsMessages,
} from "./android-sms-module"
import type { SmsImportRawMessage, SmsImportReviewItem } from "../../types/sms-import"

const mockCategorizeSmsImportMessages =
  categorizeSmsImportMessages as jest.MockedFunction<typeof categorizeSmsImportMessages>
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
    mockCategorizeSmsImportMessages.mockResolvedValue([])
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
      categorySuggestionSource: "regex",
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
      receivedAt: "2026-04-11T10:15:05.000Z",
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

  it("keeps distinct messages that share the same text within the same minute", async () => {
    const firstMessage = createMessage({
      messageId: "sms-1",
      receivedAt: "2026-04-11T10:15:05.000Z",
    })
    const secondMessage = createMessage({
      messageId: "sms-2",
      receivedAt: "2026-04-11T10:15:45.000Z",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanRecentSmsMessages.mockResolvedValue([firstMessage, secondMessage])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })

    expect(result.createdItems).toHaveLength(2)
    expect(result.createdItems.map((item) => item.sourceMessage.messageId)).toEqual([
      "sms-1",
      "sms-2",
    ])
  })

  it("prefers the native ML category when the prediction clears the confidence gate", async () => {
    const message = createMessage({
      body: "INR 250 paid to Uber Trip via credit card",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanRecentSmsMessages.mockResolvedValue([message])
    mockCategorizeSmsImportMessages.mockResolvedValue([
      {
        messageId: message.messageId,
        category: "Food",
        confidence: 0.92,
        shouldUsePrediction: true,
        modelId: "seed-litert-v1",
      },
    ])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })

    expect(result.createdItems[0]).toMatchObject({
      categorySuggestion: "Food",
      categorySuggestionConfidence: 0.92,
      categorySuggestionModelId: "seed-litert-v1",
      categorySuggestionSource: "ml",
    })
  })

  it("falls back to regex when the native prediction is below the gate", async () => {
    const message = createMessage({
      body: "INR 250 paid to Uber Trip via credit card",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanRecentSmsMessages.mockResolvedValue([message])
    mockCategorizeSmsImportMessages.mockResolvedValue([
      {
        messageId: message.messageId,
        category: "Food",
        confidence: 0.31,
        shouldUsePrediction: false,
        modelId: "seed-litert-v1",
      },
    ])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })

    expect(result.createdItems[0]).toMatchObject({
      categorySuggestion: "Transport",
      categorySuggestionSource: "regex",
      categorySuggestionConfidence: undefined,
      categorySuggestionModelId: undefined,
    })
  })

  it("can prefer ML suggestions even below the confidence gate when ML-only mode is enabled", async () => {
    const message = createMessage({
      body: "INR 250 paid to Uber Trip via credit card",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanRecentSmsMessages.mockResolvedValue([message])
    mockCategorizeSmsImportMessages.mockResolvedValue([
      {
        messageId: message.messageId,
        category: "Food",
        confidence: 0.31,
        shouldUsePrediction: false,
        modelId: "seed-litert-embed-augmented-v1",
      },
    ])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
      useMlOnlyForSmsImports: true,
    })

    expect(result.createdItems[0]).toMatchObject({
      categorySuggestion: "Food",
      categorySuggestionSource: "ml",
      categorySuggestionConfidence: 0.31,
      categorySuggestionModelId: "seed-litert-embed-augmented-v1",
    })
  })
})
