/**
 * SMS Import Module
 *
 * Main entry point for SMS expense import functionality.
 *
 * Usage:
 * ```typescript
 * import {
 *   initializeSMSImport,
 *   smsListener,
 *   hybridParser,
 *   requestSMSPermission
 * } from "./services/sms-import"
 *
 * // Initialize on app startup
 * await initializeSMSImport()
 *
 * // Check permissions
 * const hasPermission = await requestSMSPermission()
 * ```
 */

// Core services
export { smsListener, SMSListener } from "./sms-listener"
export { mlParser, MLTransactionParser } from "./ml/ml-parser"
export { duplicateDetector, DuplicateDetector } from "./duplicate-detector"
export { merchantLearningEngine, MerchantLearningEngine } from "./learning-engine"
export { inboxScanner, InboxScanner } from "./inbox-scanner"
export type { ScanProgress, ScanResult } from "./inbox-scanner"

// Settings and permissions
export {
  loadSMSImportSettings,
  saveSMSImportSettings,
  updateSMSImportSettings,
  isSMSImportEnabled,
  resetSMSImportSettings,
} from "./settings"

export {
  checkSMSPermission,
  requestSMSPermission,
  canRequestSMSPermission,
  getSMSPermissionDetails,
  isSMSSupported,
} from "./permissions"

// Types
export type { MLParseResult as MLTransactionParseResult } from "./ml/ml-parser"

// Constants
export {
  STORAGE_KEYS,
  RETENTION_LIMITS,
  DUPLICATE_THRESHOLDS,
  LEARNING_THRESHOLDS,
  TIME_WINDOWS,
  DEFAULT_SMS_IMPORT_SETTINGS,
} from "./constants"

import { smsListener } from "./sms-listener"
import { duplicateDetector } from "./duplicate-detector"
import { merchantLearningEngine } from "./learning-engine"
import { initializeReviewQueue } from "../../stores/review-queue-store"

/**
 * Initialize all SMS import services
 * Call this on app startup if SMS import is enabled
 */
export async function initializeSMSImport(): Promise<boolean> {
  try {
    // Initialize review queue store
    await initializeReviewQueue()

    // Initialize duplicate detector
    await duplicateDetector.initialize()

    // Initialize learning engine
    await merchantLearningEngine.initialize()

    // Initialize SMS listener (this will also init hybrid parser)
    const success = await smsListener.initialize()

    if (success) {
      console.log("✅ SMS Import initialized successfully")
    } else {
      console.log("ℹ️ SMS Import not initialized (disabled or no permission)")
    }

    return success
  } catch (error) {
    console.error("❌ Failed to initialize SMS Import:", error)
    return false
  }
}

/**
 * Dispose all SMS import services
 * Call this when app is shutting down or SMS import is disabled
 */
export async function disposeSMSImport(): Promise<void> {
  try {
    await smsListener.dispose()
    console.log("✅ SMS Import disposed")
  } catch (error) {
    console.error("❌ Error disposing SMS Import:", error)
  }
}
