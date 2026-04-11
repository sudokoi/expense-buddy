import { Platform } from "react-native"
import { createSmsImportFingerprint } from "./fingerprint"
import {
  getSmsPermissionStatus,
  scanRecentSmsMessages,
  SmsImportPermissionStatus,
} from "./android-sms-module"
import { parseSmsImportCandidate } from "./parser"
import { SmsImportReviewItem } from "../../types/sms-import"

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
    return previousCursor ?? new Date().toISOString()
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

  return newestMessage?.receivedAt ?? previousCursor
}

function createReviewItemFromMessage(
  existingFingerprints: Set<string>,
  message: Awaited<ReturnType<typeof scanRecentSmsMessages>>[number]
): SmsImportReviewItem | null {
  const parsedCandidate = parseSmsImportCandidate(message)
  if (!parsedCandidate) {
    return null
  }

  const fingerprint = createSmsImportFingerprint(message)
  if (existingFingerprints.has(fingerprint)) {
    return null
  }

  existingFingerprints.add(fingerprint)

  const now = new Date().toISOString()
  return {
    id: `${fingerprint}_${message.messageId}`,
    fingerprint,
    sourceMessage: message,
    amount: parsedCandidate.amount,
    currency: parsedCandidate.currency,
    merchantName: parsedCandidate.merchantName,
    categorySuggestion: parsedCandidate.categorySuggestion,
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
      ? { since: input.lastScanCursor, lookbackDays: 7 }
      : { lookbackDays: 7 }
  )

  const createdItems = messages
    .map((message) => createReviewItemFromMessage(existingFingerprints, message))
    .filter((item): item is SmsImportReviewItem => item !== null)

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
