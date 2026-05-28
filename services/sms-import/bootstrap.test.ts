jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}))

jest.mock("./android-sms-module", () => ({
  getSmsPermissionStatus: jest.fn(),
  scanAndParseMessages: jest.fn(),
}))

import { scanSmsImportReviewQueue } from "./bootstrap"
import { getSmsPermissionStatus, scanAndParseMessages } from "./android-sms-module"
import type { NativeSmsScanParseResult } from "../../modules/expense-buddy-sms-import"
import type { PaymentMethodType } from "../../types/expense"
import type { SmsImportReviewItem } from "../../types/sms-import"

const mockGetSmsPermissionStatus = getSmsPermissionStatus as jest.MockedFunction<
  typeof getSmsPermissionStatus
>
const mockScanAndParseMessages = scanAndParseMessages as jest.MockedFunction<
  typeof scanAndParseMessages
>

function createParsedMessage(
  overrides: Partial<NativeSmsScanParseResult> = {}
): NativeSmsScanParseResult {
  return {
    fingerprint: "sms_testfingerprint123",
    messageId: "sms-1",
    sender: "VK-HDFCBK",
    body: "INR 499 spent at Amazon Marketplace using debit card",
    receivedAt: "2026-04-11T10:15:30.000Z",
    amount: 499,
    currency: "INR",
    merchantName: "Amazon Marketplace using debit card",
    categorySuggestion: "Other",
    categorySuggestionSource: null,
    categorySuggestionConfidence: null,
    categorySuggestionModelId: null,
    paymentMethodType: "Debit Card",
    paymentMethodIdentifier: null,
    paymentMethodInstrumentId: null,
    noteSuggestion: "SMS import: Amazon Marketplace using debit card",
    transactionDate: "2026-04-11T10:15:30.000Z",
    matchedLocale: "en-IN",
    matchedPatternKey: "india.generic.transaction",
    ...overrides,
  }
}

function createExistingItem(parsed: NativeSmsScanParseResult): SmsImportReviewItem {
  return {
    id: `${parsed.fingerprint}_${parsed.messageId}`,
    fingerprint: parsed.fingerprint,
    sourceMessage: {
      messageId: parsed.messageId,
      sender: parsed.sender,
      body: parsed.body,
      receivedAt: parsed.receivedAt,
    },
    amount: parsed.amount ?? undefined,
    currency: parsed.currency ?? undefined,
    merchantName: parsed.merchantName ?? undefined,
    categorySuggestion: (parsed.categorySuggestion ?? undefined) as "Other" | undefined,
    paymentMethodSuggestion: parsed.paymentMethodType
      ? { type: parsed.paymentMethodType as PaymentMethodType }
      : undefined,
    noteSuggestion: parsed.noteSuggestion ?? undefined,
    transactionDate: parsed.transactionDate ?? undefined,
    matchedLocale: parsed.matchedLocale ?? undefined,
    matchedPatternKey: parsed.matchedPatternKey ?? undefined,
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

    expect(mockScanAndParseMessages).not.toHaveBeenCalled()
  })

  it("creates new review items, dedupes existing ones, and keeps a non-lossy newest cursor", async () => {
    const existingParsed = createParsedMessage()
    const newerParsed = createParsedMessage({
      fingerprint: "sms_newfingerprint456",
      messageId: "sms-2",
      body: "INR 250 paid to Uber Trip via credit card",
      amount: 250,
      merchantName: "Uber Trip",
      categorySuggestion: "Transport",
      categorySuggestionSource: "regex",
      paymentMethodType: "Credit Card",
      noteSuggestion: "SMS import: Uber Trip",
      receivedAt: "2026-04-11T10:20:00.000Z",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanAndParseMessages.mockResolvedValue([existingParsed, newerParsed])

    const existingItem = createExistingItem(existingParsed)
    const result = await scanSmsImportReviewQueue({
      existingItems: [existingItem],
      lastScanCursor: "2026-04-11T10:00:00.000Z",
      bootstrapCompletedAt: null,
    })

    expect(mockScanAndParseMessages).toHaveBeenCalledWith(
      {
        since: "2026-04-11T10:00:00.000Z",
        lookbackDays: 7,
        limit: 500,
      },
      undefined
    )
    expect(result.permissionStatus).toBe("granted")
    expect(result.createdItems).toHaveLength(1)
    expect(result.createdItems[0]).toMatchObject({
      sourceMessage: {
        messageId: "sms-2",
        sender: "VK-HDFCBK",
        body: "INR 250 paid to Uber Trip via credit card",
        receivedAt: "2026-04-11T10:20:00.000Z",
      },
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
    mockScanAndParseMessages.mockResolvedValue([])

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
    mockScanAndParseMessages.mockResolvedValue([])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })

    expect(mockScanAndParseMessages).toHaveBeenCalledWith(
      {
        lookbackDays: 7,
        limit: 500,
      },
      undefined
    )
    expect(result.nextCursor).toBeNull()
  })

  it("keeps the cursor just behind the newest timestamp to avoid missing same-timestamp messages", async () => {
    const first = createParsedMessage({
      fingerprint: "sms_first",
      messageId: "sms-1",
      receivedAt: "2026-04-11T10:20:00.000Z",
    })
    const second = createParsedMessage({
      fingerprint: "sms_second",
      messageId: "sms-2",
      body: "INR 250 paid to Uber Trip via credit card",
      amount: 250,
      merchantName: "Uber Trip",
      categorySuggestion: "Transport",
      noteSuggestion: "SMS import: Uber Trip",
      receivedAt: "2026-04-11T10:20:00.000Z",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanAndParseMessages.mockResolvedValue([first, second])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })

    expect(result.nextCursor).toBe("2026-04-11T10:19:59.999Z")
  })

  it("dedupes duplicate messages that share the same fingerprint within the same batch", async () => {
    const first = createParsedMessage({
      messageId: "sms-1",
      receivedAt: "2026-04-11T10:15:05.000Z",
    })
    const duplicate = createParsedMessage({
      messageId: "sms-2",
      receivedAt: "2026-04-11T10:15:05.000Z",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanAndParseMessages.mockResolvedValue([first, duplicate])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })

    expect(result.createdItems).toHaveLength(1)
  })

  it("dedupes messages that share the same fingerprint within the same 3-minute window", async () => {
    const first = createParsedMessage({
      messageId: "sms-1",
      fingerprint: "sms_fingerprint",
      receivedAt: "2026-04-11T10:15:05.000Z",
    })
    const second = createParsedMessage({
      messageId: "sms-2",
      fingerprint: "sms_fingerprint",
      receivedAt: "2026-04-11T10:15:45.000Z",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanAndParseMessages.mockResolvedValue([first, second])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })

    expect(result.createdItems).toHaveLength(1)
  })

  it("keeps distinct messages that have different fingerprints across different time windows", async () => {
    const first = createParsedMessage({
      messageId: "sms-1",
      fingerprint: "sms_fingerprint_a",
      receivedAt: "2026-04-11T10:12:01.000Z",
    })
    const second = createParsedMessage({
      messageId: "sms-2",
      fingerprint: "sms_fingerprint_b",
      receivedAt: "2026-04-11T10:15:01.000Z",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanAndParseMessages.mockResolvedValue([first, second])

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
    const parsed = createParsedMessage({
      body: "INR 250 paid to Uber Trip via credit card",
      categorySuggestion: "Food",
      categorySuggestionSource: "ml",
      categorySuggestionConfidence: 0.92,
      categorySuggestionModelId: "seed-litert-v1",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanAndParseMessages.mockResolvedValue([parsed])

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
    const parsed = createParsedMessage({
      body: "INR 250 paid to Uber Trip via credit card",
      categorySuggestion: "Transport",
      categorySuggestionSource: "regex",
      categorySuggestionConfidence: null,
      categorySuggestionModelId: null,
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanAndParseMessages.mockResolvedValue([parsed])

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
    const parsed = createParsedMessage({
      body: "INR 250 paid to Uber Trip via credit card",
      categorySuggestion: "Food",
      categorySuggestionSource: "ml",
      categorySuggestionConfidence: 0.31,
      categorySuggestionModelId: "seed-litert-embed-augmented-v1",
    })

    mockGetSmsPermissionStatus.mockResolvedValue("granted")
    mockScanAndParseMessages.mockResolvedValue([parsed])

    const result = await scanSmsImportReviewQueue({
      existingItems: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
      useMlOnlyForSmsImports: true,
    })

    expect(mockScanAndParseMessages).toHaveBeenCalledWith(
      {
        lookbackDays: 7,
        limit: 500,
      },
      true
    )
    expect(result.createdItems[0]).toMatchObject({
      categorySuggestion: "Food",
      categorySuggestionSource: "ml",
      categorySuggestionConfidence: 0.31,
      categorySuggestionModelId: "seed-litert-embed-augmented-v1",
    })
  })
})
