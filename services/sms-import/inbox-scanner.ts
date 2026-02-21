/**
 * Inbox Scanner
 *
 * Scans historical SMS messages for missed transactions.
 * Uses Android ContentResolver via NativeModules to read the SMS inbox,
 * then processes each message through the ML parser and duplicate detector.
 */

import { NativeModules, Platform } from "react-native"
import { requestSMSPermission, checkSMSPermission } from "./permissions"
import { mlParser } from "./ml/ml-parser"
import { duplicateDetector } from "./duplicate-detector"
import { merchantLearningEngine } from "./learning-engine"
import { reviewQueueStore } from "../../stores/review-queue-store"
import { generateId } from "../../utils/id"

export interface ScanProgress {
  scanned: number
  found: number
}

export interface ScanResult {
  totalScanned: number
  totalFound: number
  success: boolean
  error?: string
}

interface RawSMSMessage {
  address: string
  body: string
  date: string
}

/**
 * Read SMS messages from the Android inbox using ContentResolver.
 * Returns an array of raw SMS message objects.
 * Falls back to an empty array on non-Android platforms or if the native module is unavailable.
 */
async function readSMSInbox(): Promise<RawSMSMessage[]> {
  if (Platform.OS !== "android") {
    return []
  }

  try {
    const { SMSInboxReader } = NativeModules

    if (!SMSInboxReader || typeof SMSInboxReader.readInbox !== "function") {
      console.warn("SMSInboxReader native module not available - inbox scanning disabled")
      return []
    }

    const messages: RawSMSMessage[] = await SMSInboxReader.readInbox()
    return messages ?? []
  } catch (error) {
    console.error("Failed to read SMS inbox:", error)
    return []
  }
}

export class InboxScanner {
  private isScanning = false

  /**
   * Scan the SMS inbox for transaction messages.
   * Parses each message with the ML parser, checks for duplicates,
   * and adds valid non-duplicate transactions to the review queue.
   */
  async scan(onProgress?: (progress: ScanProgress) => void): Promise<ScanResult> {
    if (this.isScanning) {
      return {
        totalScanned: 0,
        totalFound: 0,
        success: false,
        error: "Scan already in progress",
      }
    }

    this.isScanning = true

    try {
      // Check and request SMS permission
      const hasPermission = await checkSMSPermission()
      if (!hasPermission) {
        const granted = await requestSMSPermission()
        if (!granted) {
          return {
            totalScanned: 0,
            totalFound: 0,
            success: false,
            error: "SMS permission not granted",
          }
        }
      }

      // Ensure ML parser is initialized
      if (!mlParser.isMLAvailable()) {
        try {
          await mlParser.initialize()
        } catch (error) {
          console.warn("Failed to initialize ML parser for inbox scan:", error)
          return {
            totalScanned: 0,
            totalFound: 0,
            success: false,
            error: "ML parser not available",
          }
        }
      }

      const messages = await readSMSInbox()
      let scanned = 0
      let found = 0

      for (const message of messages) {
        scanned++

        try {
          const parseResult = await mlParser.parse(message.body, "sms")

          if (parseResult.parsed) {
            // Update sender from the SMS address
            parseResult.parsed.metadata.sender = message.address || "Unknown"

            const duplicate = await duplicateDetector.check(parseResult.parsed)
            if (!duplicate.isDuplicate) {
              const suggestions = await merchantLearningEngine.suggest(
                parseResult.parsed.merchant
              )

              const reviewItem = {
                id: generateId(),
                parsedTransaction: parseResult.parsed,
                suggestedCategory: suggestions?.category || "Other",
                suggestedPaymentMethod: suggestions?.paymentMethod || "Other",
                suggestedInstrument: suggestions?.instrument,
                status: "pending" as const,
                createdAt: new Date().toISOString(),
              }

              reviewQueueStore.trigger.addItem({ item: reviewItem })
              found++
            }
          }
        } catch (error) {
          // Skip individual message failures silently
          console.warn("Failed to process inbox message:", error)
        }

        onProgress?.({ scanned, found })
      }

      return {
        totalScanned: scanned,
        totalFound: found,
        success: true,
      }
    } catch (error) {
      console.error("Inbox scan failed:", error)
      return {
        totalScanned: 0,
        totalFound: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    } finally {
      this.isScanning = false
    }
  }

  /**
   * Check if a scan is currently in progress
   */
  isScanInProgress(): boolean {
    return this.isScanning
  }
}

// Singleton instance
export const inboxScanner = new InboxScanner()
