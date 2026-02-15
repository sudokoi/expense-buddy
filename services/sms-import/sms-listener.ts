/**
 * SMS Listener
 *
 * Listens for incoming SMS messages and processes them
 */

import { loadSMSImportSettings } from "./settings"
import { checkSMSPermission } from "./permissions"
import { transactionParser } from "./transaction-parser"
import { duplicateDetector } from "./duplicate-detector"
import { merchantLearningEngine } from "./learning-engine"
import { reviewQueueStore } from "../../stores/review-queue-store"
import { generateId } from "../../utils/id"

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

    await this.startListening()
    return true
  }

  /**
   * Start listening for SMS messages
   */
  private async startListening(): Promise<void> {
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
  }

  /**
   * Handle an incoming SMS message
   */
  async handleIncomingMessage(message: string, sender?: string): Promise<void> {
    console.log("Processing SMS:", message.substring(0, 50) + "...")

    // Parse the message
    const parsed = await transactionParser.parse(message, "sms")

    if (!parsed) {
      console.log("Not a transaction SMS")
      return
    }

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
  }

  /**
   * Stop listening for SMS
   */
  async dispose(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe()
    }
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
