import { Platform } from "react-native"
import {
  categorizeSmsImportMessages,
  getSmsPermissionStatus,
  scanAndParseMessages,
  SmsImportPermissionStatus,
} from "./android-sms-module"
import type { NativeSmsScanParseResult } from "../../modules/expense-buddy-sms-import"
import { SmsImportReviewItem } from "../../types/sms-import"

const SMS_IMPORT_SCAN_LOOKBACK_DAYS = 7
const SMS_IMPORT_SCAN_LIMIT = 500

export interface SmsImportBootstrapInput {
  existingItems: SmsImportReviewItem[]
  lastScanCursor: string | null
  bootstrapCompletedAt: string | null
  useMlOnlyForSmsImports?: boolean
}

export interface SmsImportBootstrapResult {
  permissionStatus: SmsImportPermissionStatus
  createdItems: SmsImportReviewItem[]
  nextCursor: string | null
  bootstrapCompletedAt: string | null
}

function getNextCursor(
  messages: Array<{ receivedAt: string }>,
  previousCursor: string | null
): string | null {
  if (messages.length === 0) {
    return previousCursor
  }

  const newestMessage = messages.reduce(
    (latest, message) => {
      if (!latest) {
        return message
      }

      return new Date(message.receivedAt).getTime() >
        new Date(latest.receivedAt).getTime()
        ? message
        : latest
    },
    null as (typeof messages)[number] | null
  )

  if (!newestMessage) {
    return previousCursor
  }

  const newestTimestamp = new Date(newestMessage.receivedAt).getTime()
  if (!Number.isFinite(newestTimestamp)) {
    return previousCursor
  }

  return new Date(Math.max(0, newestTimestamp - 1)).toISOString()
}

function createReviewItem(
  parsed: NativeSmsScanParseResult,
  existingFingerprints: Set<string>,
  categoryPredictions: Map<
    string,
    {
      category: string
      confidence: number
      shouldUsePrediction: boolean
      modelId: string
    }
  >,
  useMlOnlyForSmsImports = false
): SmsImportReviewItem | null {
  if (existingFingerprints.has(parsed.fingerprint)) {
    return null
  }
  existingFingerprints.add(parsed.fingerprint)

  const prediction = categoryPredictions.get(parsed.messageId)
  const useMlCategory = useMlOnlyForSmsImports
    ? Boolean(prediction?.category)
    : (prediction?.shouldUsePrediction ?? false)

  const now = new Date().toISOString()
  const paymentMethodSuggestion = parsed.paymentMethodType
    ? {
        type: parsed.paymentMethodType,
        ...(parsed.paymentMethodIdentifier
          ? { identifier: parsed.paymentMethodIdentifier }
          : {}),
        ...(parsed.paymentMethodInstrumentId
          ? { instrumentId: parsed.paymentMethodInstrumentId }
          : {}),
      }
    : undefined

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
    categorySuggestion: useMlCategory
      ? prediction!.category
      : (parsed.categorySuggestion ?? undefined),
    categorySuggestionConfidence: useMlCategory ? prediction!.confidence : undefined,
    categorySuggestionModelId: useMlCategory ? prediction!.modelId : undefined,
    categorySuggestionSource: useMlCategory ? "ml" : "regex",
    paymentMethodSuggestion,
    noteSuggestion: parsed.noteSuggestion ?? undefined,
    transactionDate: parsed.transactionDate ?? undefined,
    matchedLocale: parsed.matchedLocale ?? undefined,
    matchedPatternKey: parsed.matchedPatternKey ?? undefined,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  }
}

export async function scanSmsImportReviewQueue(
  input: SmsImportBootstrapInput
): Promise<SmsImportBootstrapResult> {
  if (Platform.OS !== "android") {
    return {
      permissionStatus: "unavailable",
      createdItems: [],
      nextCursor: input.lastScanCursor,
      bootstrapCompletedAt: input.bootstrapCompletedAt,
    }
  }

  const permissionStatus = await getSmsPermissionStatus()
  if (permissionStatus !== "granted") {
    return {
      permissionStatus,
      createdItems: [],
      nextCursor: input.lastScanCursor,
      bootstrapCompletedAt: input.bootstrapCompletedAt,
    }
  }

  const existingFingerprints = new Set(
    input.existingItems.map((item) => item.fingerprint)
  )

  const parsedMessages = await scanAndParseMessages(
    input.lastScanCursor
      ? {
          since: input.lastScanCursor,
          lookbackDays: SMS_IMPORT_SCAN_LOOKBACK_DAYS,
          limit: SMS_IMPORT_SCAN_LIMIT,
        }
      : {
          lookbackDays: SMS_IMPORT_SCAN_LOOKBACK_DAYS,
          limit: SMS_IMPORT_SCAN_LIMIT,
        }
  )

  const categoryPredictions = await categorizeSmsImportMessages(
    parsedMessages.map((msg) => ({
      messageId: msg.messageId,
      sender: msg.sender,
      body: msg.body,
      merchantName: msg.merchantName,
    }))
  )
  const predictionByMessageId = new Map(
    categoryPredictions.map((prediction) => [prediction.messageId, prediction])
  )

  const createdItems: SmsImportReviewItem[] = []
  for (const parsed of parsedMessages) {
    const item = createReviewItem(
      parsed,
      existingFingerprints,
      predictionByMessageId,
      input.useMlOnlyForSmsImports
    )
    if (item) {
      createdItems.push(item)
    }
  }

  const bootstrapCompletedAt = input.bootstrapCompletedAt ?? new Date().toISOString()

  return {
    permissionStatus,
    createdItems,
    nextCursor: getNextCursor(parsedMessages, input.lastScanCursor),
    bootstrapCompletedAt,
  }
}

export async function bootstrapSmsImportOnLaunch(
  input: SmsImportBootstrapInput
): Promise<SmsImportBootstrapResult> {
  return scanSmsImportReviewQueue(input)
}
