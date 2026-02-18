/**
 * SMS Import Constants
 *
 * Storage keys and constants for SMS import feature
 */

/**
 * AsyncStorage keys for SMS import feature
 */
export const STORAGE_KEYS = {
  /** SMS import settings */
  IMPORT_SETTINGS: "sms_import_settings_v1",

  /** Review queue items */
  REVIEW_QUEUE: "sms_review_queue_v1",

  /** Processed message IDs (for duplicate detection) */
  PROCESSED_MESSAGE_IDS: "sms_processed_ids_v1",

  /** Merchant patterns (learning data) */
  MERCHANT_PATTERNS: "merchant_patterns_v1",

  /** User corrections (learning data) */
  USER_CORRECTIONS: "user_corrections_v1",

  /** Import statistics */
  IMPORT_STATS: "sms_import_stats_v1",
} as const

/**
 * Data retention limits
 */
export const RETENTION_LIMITS = {
  /** Maximum processed message IDs to store (rotating window) */
  MAX_PROCESSED_IDS: 1000,

  /** Maximum merchant patterns before LRU eviction */
  MAX_MERCHANT_PATTERNS: 1000,

  /** Days to keep items in review queue */
  REVIEW_QUEUE_DAYS: 30,
} as const

/**
 * Duplicate detection thresholds
 */
export const DUPLICATE_THRESHOLDS = {
  /** Similarity threshold for merchant name matching (0-1) */
  MERCHANT_SIMILARITY: 0.85,

  /** Amount tolerance for duplicate detection (as percentage) */
  AMOUNT_TOLERANCE: 0.01, // 1%
} as const

/**
 * Learning engine thresholds
 */
export const LEARNING_THRESHOLDS = {
  /** Minimum confidence to use pattern suggestion */
  MIN_PATTERN_CONFIDENCE: 0.7,

  /** Minimum similarity for fuzzy merchant matching */
  MIN_SIMILARITY_MATCH: 0.8,

  /** Minimum similarity to consider merchants related */
  MIN_FUZZY_MATCH: 0.7,

  /** Confidence boost on user confirmation */
  CONFIRMATION_BOOST: 0.05,

  /** Maximum pattern confidence */
  MAX_CONFIDENCE: 0.95,
} as const

/**
 * Time windows (in milliseconds)
 */
export const TIME_WINDOWS = {
  /** 24 hours in milliseconds */
  TWENTY_FOUR_HOURS: 24 * 60 * 60 * 1000,

  /** Pattern overwrite window (24 hours) */
  PATTERN_OVERWRITE_WINDOW: 24 * 60 * 60 * 1000,
} as const

/**
 * Default SMS import settings
 */
export const DEFAULT_SMS_IMPORT_SETTINGS = {
  enabled: false,
  scanOnLaunch: false,
  reviewRetentionDays: 30,
}
