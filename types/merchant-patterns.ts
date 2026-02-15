/**
 * Merchant Learning Types
 *
 * Type definitions for merchant pattern learning system
 */

import { PaymentMethodType } from "./expense"
import { PaymentInstrument } from "./payment-instrument"

/**
 * Learned pattern for a merchant
 */
export interface MerchantPattern {
  /** Unique pattern ID */
  id: string

  /** Normalized merchant name */
  normalizedName: string

  /** Raw merchant strings that map to this pattern */
  rawPatterns: string[]

  /** Associated category */
  category: string

  /** Associated payment method */
  paymentMethod: PaymentMethodType

  /** Associated payment instrument */
  paymentInstrument?: PaymentInstrument

  /** Confidence in this pattern (0-1) */
  confidence: number

  /** Number of times this pattern was used */
  usageCount: number

  /** Last time this pattern was used */
  lastUsed: string

  /** Whether user manually overrode this pattern */
  userOverridden: boolean
}

/**
 * Explicit user correction
 */
export interface UserCorrection {
  /** Correction ID */
  id: string

  /** Original merchant string */
  originalMerchant: string

  /** User-selected category */
  correctedCategory?: string

  /** User-selected payment method */
  correctedPaymentMethod?: PaymentMethodType

  /** User-selected instrument */
  correctedInstrument?: PaymentInstrument

  /** When correction was made */
  timestamp: string

  /** Whether to apply to future transactions */
  applyToFuture: boolean
}

/**
 * Similarity match result
 */
export interface SimilarityMatch {
  /** Matched merchant string */
  merchant: string

  /** Similarity score (0-1) */
  similarity: number

  /** Matching pattern */
  pattern: MerchantPattern
}

/**
 * Suggestion from learning engine
 */
export interface MerchantSuggestion {
  /** Suggested category */
  category?: string

  /** Suggested payment method */
  paymentMethod?: PaymentMethodType

  /** Suggested payment instrument */
  instrument?: PaymentInstrument

  /** Confidence in suggestion (0-1) */
  confidence: number
}

/**
 * File format for GitHub sync of merchant patterns
 */
export interface MerchantPatternsFile {
  /** File format version */
  version: number

  /** Last sync timestamp */
  lastSyncedAt: string

  /** Merchant patterns */
  patterns: MerchantPattern[]

  /** User corrections */
  corrections: UserCorrection[]
}

/**
 * Result of merchant pattern sync operation
 */
export interface MerchantPatternSyncResult {
  /** Whether sync was successful */
  success: boolean

  /** Number of patterns uploaded */
  uploaded: number

  /** Number of patterns downloaded */
  downloaded: number

  /** Whether merge was performed */
  merged: boolean

  /** Number of conflicts resolved */
  conflicts?: number
}
