/**
 * ML-Only Transaction Parser
 *
 * Uses TensorFlow Lite model for SMS transaction extraction.
 * All parsing is done on-device using the trained Bi-LSTM model.
 */

import type { ParsedTransaction, ImportSource } from "../../../types/sms-import"
import type { PaymentMethodType } from "../../../types/expense"
import { TFLiteSMSParser } from "./tflite-parser"
import * as Crypto from "expo-crypto"

export interface MLParseResult {
  parsed: ParsedTransaction | null
  confidence: number
  method: "ml" | "none"
  mlConfidence?: number
}

export class MLTransactionParser {
  private mlParser: TFLiteSMSParser | null = null
  private mlInitialized = false

  // Confidence threshold for ML predictions
  private readonly ML_THRESHOLD = 0.7

  /**
   * Initialize the ML model (async)
   * Call this on app startup or first SMS import
   */
  async initialize(): Promise<void> {
    try {
      this.mlParser = new TFLiteSMSParser()
      await this.mlParser.initialize()
      this.mlInitialized = true
      console.log("ML parser initialized successfully")
    } catch (error) {
      console.warn("Failed to initialize ML parser:", error)
      this.mlInitialized = false
    }
  }

  /**
   * Main parsing method - ML only approach
   */
  async parse(message: string, source: ImportSource = "sms"): Promise<MLParseResult> {
    // Check if ML is available
    if (!this.mlInitialized || !this.mlParser) {
      console.log("ML parser not available, skipping SMS processing")
      return {
        parsed: null,
        confidence: 0,
        method: "none",
      }
    }

    try {
      // Use ML parser
      const mlResult = await this.mlParser.parse(message)

      if (mlResult && mlResult.confidence >= this.ML_THRESHOLD) {
        // Build parsed transaction from ML result
        const parsedTransaction = await this.buildTransaction(mlResult, message, source)

        return {
          parsed: parsedTransaction,
          confidence: mlResult.confidence,
          method: "ml",
          mlConfidence: mlResult.confidence,
        }
      }

      // ML confidence too low
      console.log("ML confidence too low:", mlResult?.confidence ?? 0)
      return {
        parsed: null,
        confidence: mlResult?.confidence ?? 0,
        method: "none",
        mlConfidence: mlResult?.confidence ?? 0,
      }
    } catch (error) {
      console.error("ML parsing failed:", error)
      return {
        parsed: null,
        confidence: 0,
        method: "none",
      }
    }
  }

  /**
   * Check if ML model is available
   */
  isMLAvailable(): boolean {
    return this.mlInitialized
  }

  /**
   * Build a ParsedTransaction from ML result
   */
  private async buildTransaction(
    mlResult: { merchant: string; amount: number; date: string; confidence: number },
    rawMessage: string,
    source: ImportSource
  ): Promise<ParsedTransaction> {
    const messageId = await this.generateMessageId(rawMessage)
    return {
      amount: mlResult.amount,
      currency: this.detectCurrency(rawMessage),
      merchant: mlResult.merchant,
      date: mlResult.date,
      paymentMethod: this.detectPaymentMethod(rawMessage),
      paymentInstrument: undefined,
      transactionType: this.detectTransactionType(rawMessage),
      confidenceScore: mlResult.confidence,
      metadata: {
        source,
        sender: this.extractSender(rawMessage),
        messageId,
        confidenceScore: mlResult.confidence,
        parsedAt: new Date().toISOString(),
      },
      rawMessage,
    }
  }

  /**
   * Detect currency from message
   */
  private detectCurrency(message: string): string {
    const upperMessage = message.toUpperCase()
    if (upperMessage.includes("INR") || upperMessage.includes("RS.")) return "INR"
    if (upperMessage.includes("USD") || upperMessage.includes("$")) return "USD"
    if (upperMessage.includes("EUR") || upperMessage.includes("€")) return "EUR"
    if (upperMessage.includes("GBP") || upperMessage.includes("£")) return "GBP"
    if (upperMessage.includes("JPY") || upperMessage.includes("¥")) return "JPY"
    return "INR" // Default to INR for Indian market
  }

  /**
   * Detect payment method from message
   */
  private detectPaymentMethod(message: string): PaymentMethodType {
    const upperMessage = message.toUpperCase()
    if (upperMessage.includes("UPI")) return "UPI"
    if (upperMessage.includes("CREDIT CARD")) return "Credit Card"
    if (upperMessage.includes("DEBIT CARD")) return "Debit Card"
    if (upperMessage.includes("NET BANKING")) return "Net Banking"
    return "Other"
  }

  /**
   * Detect transaction type from message
   */
  private detectTransactionType(message: string): "debit" | "credit" {
    const upperMessage = message.toUpperCase()
    const creditKeywords = ["CREDITED", "RECEIVED", "REFUND", "CASHBACK"]
    const debitKeywords = ["DEBITED", "SPENT", "PAID", "WITHDRAWN", "CHARGED"]

    if (creditKeywords.some((kw) => upperMessage.includes(kw))) return "credit"
    if (debitKeywords.some((kw) => upperMessage.includes(kw))) return "debit"
    return "debit" // Default to debit
  }

  /**
   * Extract sender from message (placeholder)
   */
  private extractSender(_message: string): string {
    return "Unknown"
  }

  /**
   * Generate collision-resistant message ID using timestamp + SHA-256
   * Format: {timestamp_base36}-{first_16_chars_of_hex_hash}
   */
  private async generateMessageId(message: string): Promise<string> {
    const timestamp = Date.now().toString(36)
    try {
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, message)
      return `${timestamp}-${hash.substring(0, 16)}`
    } catch {
      // Fallback to timestamp-only ID if expo-crypto is unavailable
      return `${timestamp}-${Date.now().toString(36)}`
    }
  }

  /**
   * Dispose ML model to free memory
   */
  async dispose(): Promise<void> {
    if (this.mlParser) {
      await this.mlParser.dispose()
      this.mlParser = null
      this.mlInitialized = false
    }
  }
}

// Singleton instance
export const mlParser = new MLTransactionParser()
