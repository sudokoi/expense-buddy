import { Platform } from "react-native"
import {
  BackgroundSmsPermissionStatus,
  BackgroundSmsState,
  ExpenseBuddySmsNativeModule,
  ReviewQueueItemDto,
} from "../../modules/expense-buddy-sms-module"
export type { BackgroundSmsPermissionStatus } from "../../modules/expense-buddy-sms-module"
import ExpenseBuddySmsModule from "../../modules/expense-buddy-sms-module"
import { SmsImportReviewItem } from "../../types/sms-import"
import { PaymentMethodType } from "../../types/expense"

const PAYMENT_METHOD_TYPES = new Set<PaymentMethodType>([
  "Cash",
  "Amazon Pay",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other",
])
import { logAsync } from "../logger"

let moduleOverride: ExpenseBuddySmsNativeModule | null = null

export function setBackgroundSmsModuleForTesting(
  nextModule: ExpenseBuddySmsNativeModule | null
): void {
  moduleOverride = nextModule
}

function getBackgroundSmsModule(): ExpenseBuddySmsNativeModule | null {
  if (Platform.OS !== "android") {
    return null
  }

  return moduleOverride ?? ExpenseBuddySmsModule
}

export async function getBackgroundSmsState(): Promise<BackgroundSmsState> {
  const module = getBackgroundSmsModule()
  if (!module) {
    return { enabled: false }
  }

  return module.getBackgroundSmsStateAsync()
}

export async function getBackgroundSmsPermissionStatus(): Promise<BackgroundSmsPermissionStatus> {
  const module = getBackgroundSmsModule()
  if (!module) return "unavailable"
  const response = await module.getPermissionStatusAsync()
  return response.status
}

export async function requestBackgroundSmsPermission(): Promise<BackgroundSmsPermissionStatus> {
  const module = getBackgroundSmsModule()
  if (!module) return "unavailable"
  const response = await module.requestPermissionAsync()
  return response.status
}

export async function setBackgroundSmsEnabled(enabled: boolean): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) {
    return
  }

  await module.setBackgroundSmsEnabledAsync(enabled)
}

export async function setSmsRegion(region: string): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) {
    return
  }

  await module.setSmsRegionAsync(region)
}

export async function syncInboxAsync(useMlOnly: boolean): Promise<number> {
  const module = getBackgroundSmsModule()
  if (!module) return 0

  try {
    return await module.syncInboxAsync(useMlOnly)
  } catch (e) {
    await logAsync("ERROR", "JS_MODULE", `syncInboxAsync failed: ${e}`)
    throw e
  }
}

export async function getPendingReviewQueueAsync(): Promise<SmsImportReviewItem[]> {
  const module = getBackgroundSmsModule()
  if (!module) {
    return []
  }

  try {
    const items = await module.getPendingReviewQueueAsync()
    return items.map(dtoToReviewItem)
  } catch (e) {
    await logAsync(
      "ERROR",
      "JS_MODULE",
      `getPendingReviewQueueAsync failed: ${e}`,
      (e as Error)?.stack
    )
    throw e
  }
}

export async function approveReviewItemAsync(fingerprint: string): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) return

  try {
    await module.approveReviewItemAsync(fingerprint)
  } catch (e) {
    await logAsync(
      "ERROR",
      "JS_MODULE",
      `approveReviewItemAsync(${fingerprint}) failed: ${e}`
    )
    throw e
  }
}

export async function rejectReviewItemAsync(fingerprint: string): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) return

  try {
    await module.rejectReviewItemAsync(fingerprint)
  } catch (e) {
    await logAsync(
      "ERROR",
      "JS_MODULE",
      `rejectReviewItemAsync(${fingerprint}) failed: ${e}`
    )
    throw e
  }
}

export async function dismissReviewItemAsync(fingerprint: string): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) return

  try {
    await module.dismissReviewItemAsync(fingerprint)
  } catch (e) {
    await logAsync(
      "ERROR",
      "JS_MODULE",
      `dismissReviewItemAsync(${fingerprint}) failed: ${e}`
    )
    throw e
  }
}

export async function approveReviewItemsAsync(fingerprints: string[]): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) return

  try {
    await module.approveItemsAsync(fingerprints)
  } catch (e) {
    await logAsync("ERROR", "JS_MODULE", `approveReviewItemsAsync failed: ${e}`)
    throw e
  }
}

export async function rejectReviewItemsAsync(fingerprints: string[]): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) return

  try {
    await module.rejectItemsAsync(fingerprints)
  } catch (e) {
    await logAsync("ERROR", "JS_MODULE", `rejectReviewItemsAsync failed: ${e}`)
    throw e
  }
}

export async function dismissReviewItemsAsync(fingerprints: string[]): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) return

  try {
    await module.dismissItemsAsync(fingerprints)
  } catch (e) {
    await logAsync("ERROR", "JS_MODULE", `dismissReviewItemsAsync failed: ${e}`)
    throw e
  }
}

export async function dismissNotificationAsync(): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) return

  try {
    await module.dismissNotificationAsync()
  } catch (e) {
    await logAsync("ERROR", "JS_MODULE", `dismissNotificationAsync failed: ${e}`)
  }
}

// Boundary validation: native packs must emit closed-vocabulary types;
// drop unknown values instead of persisting them into expenses.
function toPaymentMethodSuggestion(
  dto: ReviewQueueItemDto
): SmsImportReviewItem["paymentMethodSuggestion"] {
  const rawType = dto.paymentMethodType
  const validType =
    rawType && PAYMENT_METHOD_TYPES.has(rawType as PaymentMethodType)
      ? (rawType as PaymentMethodType)
      : undefined

  if (!validType) {
    return undefined
  }

  return {
    type: validType,
    identifier: dto.paymentMethodIdentifier ?? undefined,
    instrumentId: dto.paymentMethodInstrumentId ?? undefined,
  }
}

function dtoToReviewItem(dto: ReviewQueueItemDto): SmsImportReviewItem {
  const statusMap: Record<string, SmsImportReviewItem["status"]> = {
    PENDING: "pending",
    APPROVED: "accepted",
    REJECTED: "rejected",
    DISMISSED: "dismissed",
  }
  return {
    id: dto.sourceMessageId,
    fingerprint: dto.fingerprint,
    sourceMessage: {
      messageId: dto.sourceMessageId,
      sender: dto.sender,
      body: dto.body,
      receivedAt: dto.sourceReceivedAt,
    },
    amount: dto.amount ?? undefined,
    currency: dto.currency ?? undefined,
    merchantName: dto.merchantName ?? undefined,
    categorySuggestion: dto.categorySuggestion ?? undefined,
    paymentMethodSuggestion: toPaymentMethodSuggestion(dto),
    noteSuggestion: dto.noteSuggestion ?? undefined,
    transactionDate: dto.transactionDate ?? undefined,
    matchedLocale: dto.matchedLocale ?? undefined,
    matchedPatternKey: dto.matchedPatternKey ?? undefined,
    status: statusMap[dto.status] ?? "pending",
    acceptedExpenseId: dto.acceptedExpenseId ?? undefined,
    createdAt: new Date(dto.createdAt).toISOString(),
    updatedAt: new Date(dto.updatedAt).toISOString(),
  }
}
