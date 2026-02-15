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
 * Bank pattern configuration
 */
export const BANK_PATTERNS = {
  // Indian Banks
  HDFC: {
    name: "HDFC Bank",
    regex:
      /(?:Rs\.?|INR)\s*([\d,.]+)\s*(?:debited|credited).*?from\s*\*+(\d+).*?to\s*(.+?)(?:\.|$)/i,
    baseConfidence: 0.85,
    region: "IN" as const,
  },
  ICICI: {
    name: "ICICI Bank",
    regex: /(?:Rs\.?|INR)\s*([\d,.]+)\s*(?:spent|paid).*?(?:at|to)\s+(.+?)(?:\.|\s+on)/i,
    baseConfidence: 0.85,
    region: "IN" as const,
  },
  SBI: {
    name: "State Bank of India",
    regex: /Rs\.?\s*([\d,.]+)\s*withdrawn\s*from\s*(.+?)(?:\s+on|$)/i,
    baseConfidence: 0.8,
    region: "IN" as const,
  },
  AXIS: {
    name: "Axis Bank",
    regex: /INR\s*([\d,.]+)\s*paid\s*to\s*(.+?)(?:\s+via|$)/i,
    baseConfidence: 0.85,
    region: "IN" as const,
  },
  KOTAK: {
    name: "Kotak Mahindra Bank",
    regex: /Rs\.?\s*([\d,.]+)\s*debited\s*from\s*account/i,
    baseConfidence: 0.8,
    region: "IN" as const,
  },

  // US Banks
  CHASE: {
    name: "Chase",
    regex:
      /(?:You made a|A)\s*\$?([\d,.]+)\s*(?:transaction|purchase|payment).*?(?:at|to|with)\s+(.+?)(?:\s+on|\.|\s*$)/i,
    baseConfidence: 0.85,
    region: "US" as const,
  },
  BOFA: {
    name: "Bank of America",
    regex:
      /\$?([\d,.]+)\s*(?:was charged|purchase|transaction).*?(?:at|to)\s+(.+?)(?:\s+on|\.|\s*$)/i,
    baseConfidence: 0.85,
    region: "US" as const,
  },
  WELLS_FARGO: {
    name: "Wells Fargo",
    regex:
      /(?:Purchase|Transaction)\s*(?:of\s*)?\$?([\d,.]+).*?(?:at|to)\s+(.+?)(?:\s+on|\.|\s*$)/i,
    baseConfidence: 0.8,
    region: "US" as const,
  },
  CITI: {
    name: "Citi",
    regex:
      /\$?([\d,.]+)\s*(?:spent|charged|transaction).*?(?:at|to)\s+(.+?)(?:\s+on|\.|\s*$)/i,
    baseConfidence: 0.8,
    region: "US" as const,
  },

  // EU Banks
  REVOLUT: {
    name: "Revolut",
    regex:
      /(?:€|EUR|£|GBP)\s*([\d,.]+)\s*(?:paid|sent|spent).*?(?:at|to)\s+(.+?)(?:\s+on|\.|\s*$)/i,
    baseConfidence: 0.85,
    region: "EU" as const,
  },
  N26: {
    name: "N26",
    regex:
      /(?:€|EUR)\s*([\d,.]+)\s*(?:card payment|direct debit|transfer).*?(?:at|to|from)\s+(.+?)(?:\s+on|\.|\s*$)/i,
    baseConfidence: 0.8,
    region: "EU" as const,
  },
  ING: {
    name: "ING",
    regex:
      /(?:€|EUR)\s*([\d,.]+)\s*(?:betaling|payment|afschrijving).*?(?:aan|at|to)\s+(.+?)(?:\s+op|\.|\s*$)/i,
    baseConfidence: 0.8,
    region: "EU" as const,
  },

  // JP Banks
  MUFG: {
    name: "MUFG (三菱UFJ)",
    regex: /(?:¥|JPY)\s*([\d,]+)\s*(?:引落|振込|お支払い).*?(.+?)(?:\s|$)/i,
    baseConfidence: 0.75,
    region: "JP" as const,
  },
  SMBC: {
    name: "SMBC (三井住友)",
    regex: /(?:¥|JPY)\s*([\d,]+)\s*(?:ご利用|お引落し).*?(.+?)(?:\s|$)/i,
    baseConfidence: 0.75,
    region: "JP" as const,
  },
  MIZUHO: {
    name: "Mizuho (みずほ)",
    regex: /(?:¥|JPY)\s*([\d,]+)\s*(?:お振込|ご利用).*?(.+?)(?:\s|$)/i,
    baseConfidence: 0.75,
    region: "JP" as const,
  },
}

/**
 * Default SMS import settings
 */
export const DEFAULT_SMS_IMPORT_SETTINGS = {
  enabled: false,
  scanOnLaunch: false,
  reviewRetentionDays: 30,
}
