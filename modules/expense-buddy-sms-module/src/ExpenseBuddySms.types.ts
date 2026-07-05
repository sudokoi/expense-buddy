import { NativeModule } from "expo"

export interface BackgroundSmsState {
  enabled: boolean
}

export type BackgroundSmsPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "unavailable"

export interface BackgroundSmsPermissionResponse {
  status: BackgroundSmsPermissionStatus
  expires: "never" | number
  granted: boolean
  canAskAgain: boolean
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

export interface ExpenseBuddySmsNativeModule extends NativeModule {
  addListener(eventName: "onReviewQueueUpdated", listener: () => void): { remove(): void }
  getBackgroundSmsStateAsync(): Promise<BackgroundSmsState>
  setBackgroundSmsEnabledAsync(enabled: boolean): Promise<void>
  syncInboxAsync(useMlOnly: boolean): Promise<number>
  getPermissionStatusAsync(): Promise<BackgroundSmsPermissionResponse>
  requestPermissionAsync(): Promise<BackgroundSmsPermissionResponse>

  getPendingReviewQueueAsync(): Promise<ReviewQueueItemDto[]>
  approveReviewItemAsync(fingerprint: string): Promise<void>
  rejectReviewItemAsync(fingerprint: string): Promise<void>
  dismissReviewItemAsync(fingerprint: string): Promise<void>
  approveItemsAsync(fingerprints: string[]): Promise<void>
  rejectItemsAsync(fingerprints: string[]): Promise<void>
  dismissItemsAsync(fingerprints: string[]): Promise<void>
  dismissNotificationAsync(): Promise<void>
}
