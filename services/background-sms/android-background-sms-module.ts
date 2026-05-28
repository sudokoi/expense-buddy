import { Platform } from "react-native"
import {
  BackgroundSmsPermissionStatus,
  BackgroundSmsState,
  ExpenseBuddyBackgroundSmsNativeModule,
  ReviewQueueItemDto,
} from "../../modules/expense-buddy-background-sms"
export type { BackgroundSmsPermissionStatus } from "../../modules/expense-buddy-background-sms"
import ExpenseBuddyBackgroundSmsModule from "../../modules/expense-buddy-background-sms"
import { SmsImportReviewItem } from "../../types/sms-import"
import { PaymentMethodType } from "../../types/expense"
import { logAsync } from "../logger"

let moduleOverride: ExpenseBuddyBackgroundSmsNativeModule | null = null

export function setBackgroundSmsModuleForTesting(
  nextModule: ExpenseBuddyBackgroundSmsNativeModule | null
): void {
  moduleOverride = nextModule
}

function getBackgroundSmsModule(): ExpenseBuddyBackgroundSmsNativeModule | null {
  if (Platform.OS !== "android") {
    return null
  }

  return moduleOverride ?? ExpenseBuddyBackgroundSmsModule
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

export async function insertPendingItemsAsync(
  items: SmsImportReviewItem[]
): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) return

  try {
    const json = JSON.stringify(items.map(reviewItemToDto))
    await module.insertPendingItemsAsync(json)
  } catch (e) {
    await logAsync("ERROR", "JS_MODULE", `insertPendingItemsAsync failed: ${e}`)
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

function dtoToReviewItem(dto: ReviewQueueItemDto): SmsImportReviewItem {
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
    categorySuggestion: (dto.categorySuggestion ?? undefined) as any,
    paymentMethodSuggestion:
      dto.paymentMethodType ||
      dto.paymentMethodIdentifier ||
      dto.paymentMethodInstrumentId
        ? {
            type: (dto.paymentMethodType ?? "") as PaymentMethodType,
            identifier: dto.paymentMethodIdentifier ?? undefined,
            instrumentId: dto.paymentMethodInstrumentId ?? undefined,
          }
        : undefined,
    noteSuggestion: dto.noteSuggestion ?? undefined,
    transactionDate: dto.transactionDate ?? undefined,
    matchedLocale: dto.matchedLocale ?? undefined,
    matchedPatternKey: dto.matchedPatternKey ?? undefined,
    status: dto.status as SmsImportReviewItem["status"],
    acceptedExpenseId: dto.acceptedExpenseId ?? undefined,
    createdAt: new Date(dto.createdAt).toISOString(),
    updatedAt: new Date(dto.updatedAt).toISOString(),
  }
}

function reviewItemToDto(item: SmsImportReviewItem): ReviewQueueItemDto {
  return {
    fingerprint: item.fingerprint,
    sender: item.sourceMessage.sender,
    body: item.sourceMessage.body,
    amount: item.amount ?? null,
    currency: item.currency ?? null,
    merchantName: item.merchantName ?? null,
    categorySuggestion: item.categorySuggestion ?? null,
    paymentMethodType: item.paymentMethodSuggestion?.type ?? null,
    paymentMethodIdentifier: item.paymentMethodSuggestion?.identifier ?? null,
    paymentMethodInstrumentId: item.paymentMethodSuggestion?.instrumentId ?? null,
    noteSuggestion: item.noteSuggestion ?? null,
    transactionDate: item.transactionDate ?? null,
    matchedLocale: item.matchedLocale ?? null,
    matchedPatternKey: item.matchedPatternKey ?? null,
    status: item.status,
    acceptedExpenseId: item.acceptedExpenseId ?? null,
    sourceMessageId: item.sourceMessage.messageId,
    sourceReceivedAt: item.sourceMessage.receivedAt,
    createdAt: new Date(item.createdAt).getTime(),
    updatedAt: new Date(item.updatedAt).getTime(),
  }
}
