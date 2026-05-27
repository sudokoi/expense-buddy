import { NativeModule } from "expo"

export interface BackgroundSmsState {
  enabled: boolean
}

export interface ReviewQueueItemDto {
  fingerprint: string
  sender: string
  body: string
  amount: number | null
  currency: string | null
  merchantName: string | null
  categorySuggestion: string | null
  paymentMethodType: string | null
  paymentMethodIdentifier: string | null
  paymentMethodInstrumentId: string | null
  noteSuggestion: string | null
  transactionDate: string | null
  matchedLocale: string | null
  matchedPatternKey: string | null
  status: string
  acceptedExpenseId: string | null
  sourceMessageId: string
  sourceReceivedAt: string
  createdAt: number
  updatedAt: number
}

export interface ExpenseBuddyBackgroundSmsNativeModule extends NativeModule {
  getBackgroundSmsStateAsync(): Promise<BackgroundSmsState>
  setBackgroundSmsEnabledAsync(enabled: boolean): Promise<void>

  getPendingReviewQueueAsync(): Promise<ReviewQueueItemDto[]>
  approveReviewItemAsync(fingerprint: string): Promise<void>
  rejectReviewItemAsync(fingerprint: string): Promise<void>
  dismissReviewItemAsync(fingerprint: string): Promise<void>
  insertPendingItemsAsync(itemsJson: string): Promise<void>
}
