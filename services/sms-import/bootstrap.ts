import { Platform } from "react-native"
import { createSmsImportFingerprint } from "./fingerprint"
import {
  categorizeSmsImportMessages,
  getSmsPermissionStatus,
  scanRecentSmsMessages,
  SmsImportPermissionStatus,
} from "./android-sms-module"
import { parseSmsImportCandidate, ParsedSmsImportCandidate } from "./parser"
import { SmsImportReviewItem } from "../../types/sms-import"

const SMS_IMPORT_SCAN_LOOKBACK_DAYS = 7
const SMS_IMPORT_SCAN_LIMIT = 500

interface ParsedBootstrapCandidate {
  fingerprint: string
  message: Awaited<ReturnType<typeof scanRecentSmsMessages>>[number]
  parsedCandidate: ParsedSmsImportCandidate
}

export interface SmsImportBootstrapInput {
  existingItems: SmsImportReviewItem[]
  lastScanCursor: string | null
  bootstrapCompletedAt: string | null
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

  // The native Android query uses DATE > since, so keep the cursor 1 ms behind the
  // newest scanned message to avoid skipping sibling messages with the same timestamp.
  return new Date(Math.max(0, newestTimestamp - 1)).toISOString()
}

function createParsedBootstrapCandidate(
  existingFingerprints: Set<string>,
  message: Awaited<ReturnType<typeof scanRecentSmsMessages>>[number]
): ParsedBootstrapCandidate | null {
  const parsedCandidate = parseSmsImportCandidate(message)
  if (!parsedCandidate) {
    return null
  }

  const fingerprint = createSmsImportFingerprint(message)
  if (existingFingerprints.has(fingerprint)) {
    return null
  }

  existingFingerprints.add(fingerprint)

  return {
    fingerprint,
    message,
    parsedCandidate,
  }
}

function createReviewItem(
  candidate: ParsedBootstrapCandidate,
  categoryPrediction?: Awaited<
    ReturnType<typeof categorizeSmsImportMessages>
  >[number]
): SmsImportReviewItem {
  const { fingerprint, message, parsedCandidate } = candidate
  const useMlCategory = categoryPrediction?.shouldUsePrediction ?? false

  const now = new Date().toISOString()
  return {
    id: `${fingerprint}_${message.messageId}`,
    fingerprint,
    sourceMessage: message,
    amount: parsedCandidate.amount,
    currency: parsedCandidate.currency,
    merchantName: parsedCandidate.merchantName,
    categorySuggestion: useMlCategory
      ? categoryPrediction?.category
      : parsedCandidate.categorySuggestion,
    categorySuggestionConfidence: useMlCategory
      ? categoryPrediction?.confidence
      : undefined,
    categorySuggestionModelId: useMlCategory ? categoryPrediction?.modelId : undefined,
    categorySuggestionSource: useMlCategory ? "ml" : "regex",
    paymentMethodSuggestion: parsedCandidate.paymentMethodSuggestion,
    noteSuggestion: parsedCandidate.noteSuggestion,
    transactionDate: parsedCandidate.transactionDate,
    matchedLocale: parsedCandidate.matchedLocale,
    matchedPatternKey: parsedCandidate.matchedPatternKey,
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
  const messages = await scanRecentSmsMessages(
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

  const parsedCandidates = messages
    .map((message) => createParsedBootstrapCandidate(existingFingerprints, message))
    .filter((candidate): candidate is ParsedBootstrapCandidate => candidate !== null)

  const categoryPredictions = await categorizeSmsImportMessages(
    parsedCandidates.map((candidate) => ({
      messageId: candidate.message.messageId,
      sender: candidate.message.sender,
      body: candidate.message.body,
      merchantName: candidate.parsedCandidate.merchantName,
    }))
  )
  const predictionByMessageId = new Map(
    categoryPredictions.map((prediction) => [prediction.messageId, prediction])
  )

  const createdItems = parsedCandidates.map((candidate) =>
    createReviewItem(
      candidate,
      predictionByMessageId.get(candidate.message.messageId)
    )
  )

  const bootstrapCompletedAt = input.bootstrapCompletedAt ?? new Date().toISOString()

  return {
    permissionStatus,
    createdItems,
    nextCursor: getNextCursor(messages, input.lastScanCursor),
    bootstrapCompletedAt,
  }
}

export async function bootstrapSmsImportOnLaunch(
  input: SmsImportBootstrapInput
): Promise<SmsImportBootstrapResult> {
  return scanSmsImportReviewQueue(input)
}
