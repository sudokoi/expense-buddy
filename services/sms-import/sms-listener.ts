/**
 * SMS Listener
 *
 * Listens for incoming SMS messages and processes them using ML parser
 */

import { loadSMSImportSettings } from "./settings"
import { checkSMSPermission } from "./permissions"
import { mlParser } from "./ml/ml-parser"
import { duplicateDetector } from "./duplicate-detector"
import { merchantLearningEngine } from "./learning-engine"
import { reviewQueueStore } from "../../stores/review-queue-store"
import { generateId } from "../../utils/id"
import { ParsedTransaction } from "../../types/sms-import"

export class SMSListener {
  private isListening = false
  private unsubscribe?: () => void

  /**
   * Initialize the SMS listener
   */
  async initialize(): Promise<boolean> {
    const settings = await loadSMSImportSettings()

    if (!settings.enabled) {
      return false
    }

    const hasPermission = await checkSMSPermission()
    if (!hasPermission) {
      console.log("SMS permission not granted")
      return false
    }

    // Initialize ML parser (loads model if available)
    try {
      await mlParser.initialize()
    } catch (error) {
      console.warn("Failed to initialize ML parser:", error)
      // SMS import won't work without ML, but we still return true
      // The listener is active, it just won't parse messages
    }

    await this.startListening()
    return true
  }

  /**
   * Start listening for SMS messages
   *
   * Only listens for NEW messages going forward. Does NOT scan historical
   * SMS messages when first enabled, as users may have already manually
   * added those transactions to the app.
   */
  private async startListening(): Promise<void> {
    try {
      // Note: This is a placeholder. The actual implementation would use
      // @maniac-tech/react-native-expo-read-sms to listen for SMS
      // For now, we'll create a mock implementation

      console.log("SMS listener started (mock implementation)")
      this.isListening = true

      // In real implementation:
      // this.unsubscribe = startReadSMS((status, sms, error) => {
      //   if (status === 'success' && sms) {
      //     this.handleIncomingMessage(sms)
      //   }
      // })
    } catch (error) {
      console.error("Failed to start SMS listener:", error)
      this.isListening = false
      // Don't throw - app should continue working without SMS import
    }
  }

  /**
   * Handle an incoming SMS message
   *
   * NOTE: Only processes NEW messages received after SMS import is enabled.
   * We intentionally do NOT scan historical SMS messages when the feature is
   * first enabled, as users may have already manually added those transactions.
   */
  async handleIncomingMessage(message: string, sender?: string): Promise<void> {
    // Safety check: Ensure SMS import is enabled before processing
    const settings = await loadSMSImportSettings()
    if (!settings.enabled) {
      console.log("SMS import is disabled, ignoring message")
      return
    }

    console.log("Processing SMS:", message.substring(0, 50) + "...")

    try {
      // Parse the message using ML parser
      const parseResult = await mlParser.parse(message, "sms")

      if (!parseResult.parsed) {
        console.log(
          "Could not parse SMS - neither regex nor ML could extract transaction data"
        )
        console.log("Parse method used:", parseResult.method)
        console.log("Confidence:", parseResult.confidence)
        // Optionally: Show manual entry prompt or skip
        return
      }

      const parsed: ParsedTransaction = parseResult.parsed

      // Log parsing result
      console.log(`Parsed with ML (confidence: ${parseResult.confidence.toFixed(2)})`)

      // Update sender if provided
      if (sender) {
        parsed.metadata.sender = sender
      }

      // Check for duplicates
      const duplicate = await duplicateDetector.check(parsed)
      if (duplicate.isDuplicate) {
        console.log("Duplicate detected, skipping")
        await duplicateDetector.markProcessed(parsed.metadata.messageId)
        return
      }

      // Get suggestions from learning engine
      const suggestions = await merchantLearningEngine.suggest(parsed.merchant)

      // Add to review queue
      const reviewItem = {
        id: generateId(),
        parsedTransaction: parsed,
        suggestedCategory: suggestions?.category || "Other",
        suggestedPaymentMethod: suggestions?.paymentMethod || "Other",
        suggestedInstrument: suggestions?.instrument,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      }

      reviewQueueStore.trigger.addItem({ item: reviewItem })
      console.log("Added to review queue:", reviewItem.id)

      // Show notification (optional)
      // await this.showImportNotification(parsed)
    } catch (error) {
      // Critical: Never crash the app due to SMS parsing errors
      console.error("Error processing SMS message:", error)
      console.log("SMS processing failed gracefully - app continues running")
      // Silently fail - the message is not a transaction or couldn't be parsed
    }
  }

  /**
   * Stop listening for SMS
   */
  async dispose(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe()
    }

    // Dispose ML parser to free memory
    await mlParser.dispose()

    this.isListening = false
    console.log("SMS listener stopped")
  }

  /**
   * Check if currently listening
   */
  isActive(): boolean {
    return this.isListening
  }
}

// Singleton instance
export const smsListener = new SMSListener()
