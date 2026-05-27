import { Platform } from "react-native"
import {
  BackgroundSmsState,
  ExpenseBuddyBackgroundSmsNativeModule,
  ReviewQueueItemDto,
} from "../../modules/expense-buddy-background-sms"
import ExpenseBuddyBackgroundSmsModule from "../../modules/expense-buddy-background-sms"
import { SmsImportReviewItem } from "../../types/sms-import"

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

export async function setBackgroundSmsEnabled(enabled: boolean): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) {
    return
  }

  await module.setBackgroundSmsEnabledAsync(enabled)
}

export async function getPendingReviewQueueAsync(): Promise<SmsImportReviewItem[]> {
  const module = getBackgroundSmsModule()
  if (!module) {
    return []
  }

  try {
    const items = await module.getPendingReviewQueueAsync()
    return items.map(dtoToReviewItem)
  } catch {
    return []
  }
}

export async function approveReviewItemAsync(fingerprint: string): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) return

  try {
    await module.approveReviewItemAsync(fingerprint)
  } catch {
    // non-critical
  }
}

export async function rejectReviewItemAsync(fingerprint: string): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) return

  try {
    await module.rejectReviewItemAsync(fingerprint)
  } catch {
    // non-critical
  }
}

export async function dismissReviewItemAsync(fingerprint: string): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) return

  try {
    await module.dismissReviewItemAsync(fingerprint)
  } catch {
    // non-critical
  }
}

export async function insertPendingItemsAsync(
  items: SmsImportReviewItem[]
): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) return

  try {
    await module.insertPendingItemsAsync(JSON.stringify(items.map(reviewItemToDto)))
  } catch {
    // non-critical
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
            type: dto.paymentMethodType ?? "",
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
