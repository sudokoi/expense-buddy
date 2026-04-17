import { ExpenseCategory, PaymentMethod } from "./expense"

export type SmsImportReviewStatus = "pending" | "accepted" | "rejected" | "dismissed"

export interface SmsImportRawMessage {
  messageId: string
  sender: string
  body: string
  receivedAt: string
}

export interface SmsImportReviewItem {
  id: string
  fingerprint: string
  sourceMessage: SmsImportRawMessage
  amount?: number
  currency?: string
  merchantName?: string
  categorySuggestion?: ExpenseCategory
  categorySuggestionConfidence?: number
  categorySuggestionModelId?: string
  categorySuggestionSource?: "regex" | "ml"
  paymentMethodSuggestion?: PaymentMethod
  noteSuggestion?: string
  transactionDate?: string
  matchedLocale?: string
  matchedPatternKey?: string
  status: SmsImportReviewStatus
  acceptedExpenseId?: string
  createdAt: string
  updatedAt: string
}

export interface SmsImportReviewQueueSnapshot {
  items: SmsImportReviewItem[]
  lastScanCursor: string | null
  bootstrapCompletedAt: string | null
}
