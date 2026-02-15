/**
 * SMS Import Types
 *
 * Type definitions for SMS-based expense import functionality
 */

import { PaymentMethodType } from "./expense"
import { PaymentInstrument } from "./payment-instrument"

/**
 * Source of the import (SMS-only in v1)
 */
export type ImportSource = "sms"

/**
 * Metadata attached to auto-imported expenses
 */
export interface SMSImportMetadata {
  /** Source type (always "sms" in v1) */
  source: ImportSource

  /** Original raw message content */
  rawMessage: string

  /** SMS sender address (e.g., "AD-HDFCBK") */
  sender: string

  /** Unique message identifier for duplicate detection */
  messageId: string

  /** Parsing confidence score (0-1) */
  confidenceScore: number

  /** When the message was parsed */
  parsedAt: string

  /** When user reviewed the import */
  reviewedAt?: string

  /** Whether user manually corrected data */
  userCorrected?: boolean
}

/**
 * Transaction data extracted from SMS
 */
export interface ParsedTransaction {
  /** Transaction amount */
  amount: number

  /** Currency code (ISO 4217) */
  currency: string

  /** Merchant or recipient name */
  merchant: string

  /** Transaction date */
  date: string

  /** Payment method type */
  paymentMethod: PaymentMethodType

  /** Payment instrument details */
  paymentInstrument?: {
    type: string
    lastDigits?: string
  }

  /** Debit or credit transaction */
  transactionType: "debit" | "credit"

  /** Overall parsing confidence */
  confidenceScore: number

  /** Import metadata */
  metadata: SMSImportMetadata
}

/**
 * Item in the review queue
 */
export interface ReviewQueueItem {
  /** Unique queue item ID */
  id: string

  /** Parsed transaction data */
  parsedTransaction: ParsedTransaction

  /** Suggested category from learning engine */
  suggestedCategory: string

  /** Suggested payment method */
  suggestedPaymentMethod: PaymentMethodType

  /** Suggested payment instrument */
  suggestedInstrument?: PaymentInstrument

  /** Current review status */
  status: "pending" | "confirmed" | "edited" | "rejected"

  /** When item was added to queue */
  createdAt: string
}

/**
 * Settings for SMS import feature (v1 - SMS only)
 */
export interface SMSImportSettings {
  /** Master enable/disable switch for SMS import */
  enabled: boolean

  /** Scan inbox on app launch */
  scanOnLaunch: boolean

  /** Days to keep items in review queue */
  reviewRetentionDays: number
}

/**
 * Bank pattern definition for transaction parsing
 */
export interface BankPattern {
  /** Bank name */
  name: string

  /** Regex pattern to match SMS */
  regex: RegExp

  /** Base confidence score for this pattern */
  baseConfidence: number

  /** Country/region code */
  region: "IN" | "US" | "EU" | "JP"
}

/**
 * Result of parsing attempt
 */
export interface ParseResult {
  /** Parsed transaction data (null if not a transaction SMS) */
  parsed: ParsedTransaction | null

  /** Confidence score of the parse */
  confidence: number
}

/**
 * Duplicate check result
 */
export interface DuplicateCheck {
  /** Whether this is a duplicate */
  isDuplicate: boolean

  /** Matched existing expense (if duplicate) */
  matchedExpense?: {
    id: string
    amount: number
    date: string
    note: string
  }

  /** Confidence of duplicate detection */
  confidence: number

  /** Reason for duplicate detection */
  reason: "message_id" | "amount_date_merchant" | "none"
}

/**
 * SMS import statistics
 */
export interface SMSImportStats {
  /** Total SMS messages processed */
  totalProcessed: number

  /** Successfully parsed transactions */
  totalParsed: number

  /** Duplicates detected */
  totalDuplicates: number

  /** Items in review queue */
  pendingReview: number

  /** Last import timestamp */
  lastImportAt?: string
}
