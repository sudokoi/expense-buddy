/**
 * Hybrid Transaction Parser
 *
 * Combines regex-based parsing with ML model for robust SMS extraction.
 * Strategy:
 * 1. Try regex first (fast, deterministic)
 * 2. If regex confidence < 0.8, use ML model
 * 3. If ML confidence < 0.7, return null (manual entry required)
 */

import type { ParsedTransaction, ImportSource } from "../../../types/sms-import"
import { TransactionParser as RegexParser } from "../transaction-parser"
import { TFLiteSMSParser } from "./tflite-parser"

export interface HybridParseResult {
  parsed: ParsedTransaction | null
  confidence: number
  method: "regex" | "ml" | "none"
  regexConfidence?: number
  mlConfidence?: number
}

export class HybridTransactionParser {
  private regexParser: RegexParser
  private mlParser: TFLiteSMSParser | null = null
  private mlInitialized = false

  // Confidence thresholds
  private readonly REGEX_THRESHOLD = 0.8
  private readonly ML_THRESHOLD = 0.7

  constructor() {
    this.regexParser = new RegexParser()
  }

  /**
   * Initialize the ML model (async)
   * Call this on app startup or first SMS import
   */
  async initialize(): Promise<void> {
    try {
      this.mlParser = new TFLiteSMSParser()
      await this.mlParser.initialize()
      this.mlInitialized = true
    } catch (error) {
      console.warn("Failed to initialize ML parser:", error)
      // Continue without ML - regex will handle everything
    }
  }

  /**
   * Main parsing method - hybrid approach
   */
  async parse(message: string, source: ImportSource = "sms"): Promise<HybridParseResult> {
    // Stage 1: Try regex parser (fast path)
    const regexResult = await this.regexParser.parse(message, source)

    if (regexResult && regexResult.confidenceScore >= this.REGEX_THRESHOLD) {
      return {
        parsed: regexResult,
        confidence: regexResult.confidenceScore,
        method: "regex",
        regexConfidence: regexResult.confidenceScore,
      }
    }

    // Stage 2: Try ML parser for uncertain cases
    if (this.mlInitialized && this.mlParser) {
      try {
        const mlResult = await this.mlParser.parse(message)

        if (mlResult && mlResult.confidence >= this.ML_THRESHOLD) {
          // Merge ML result with regex fallback
          const mergedResult = this.mergeResults(regexResult, mlResult, source)

          return {
            parsed: mergedResult,
            confidence: mlResult.confidence,
            method: "ml",
            regexConfidence: regexResult?.confidenceScore ?? 0,
            mlConfidence: mlResult.confidence,
          }
        }
      } catch (error) {
        console.warn("ML parsing failed:", error)
      }
    }

    // Stage 3: Neither parser confident enough
    return {
      parsed: null,
      confidence: Math.max(regexResult?.confidenceScore ?? 0, 0),
      method: "none",
      regexConfidence: regexResult?.confidenceScore ?? 0,
    }
  }

  /**
   * Quick parse without ML (for performance-critical paths)
   */
  async parseFast(
    message: string,
    source: ImportSource = "sms"
  ): Promise<ParsedTransaction | null> {
    const result = await this.regexParser.parse(message, source)
    return result && result.confidenceScore >= this.REGEX_THRESHOLD ? result : null
  }

  /**
   * Check if ML model is available
   */
  isMLAvailable(): boolean {
    return this.mlInitialized
  }

  /**
   * Merge regex and ML results, taking best from each
   */
  private mergeResults(
    regexResult: ParsedTransaction | null,
    mlResult: { merchant: string; amount: number; date: string; confidence: number },
    source: ImportSource
  ): ParsedTransaction {
    // Use ML for merchant (better at fuzzy matching)
    // Use regex for amount/date (more precise when available)
    const merchant = mlResult.merchant || regexResult?.merchant || "Unknown"
    const amount = regexResult?.amount || mlResult.amount || 0
    const date = regexResult?.date || mlResult.date || new Date().toISOString()

    return {
      amount,
      currency: regexResult?.currency || "INR",
      merchant,
      date,
      paymentMethod: regexResult?.paymentMethod || "Other",
      paymentInstrument: regexResult?.paymentInstrument,
      transactionType: regexResult?.transactionType || "debit",
      confidenceScore: mlResult.confidence,
      metadata: {
        source,
        rawMessage: regexResult?.metadata.rawMessage || "",
        sender: regexResult?.metadata.sender || "Unknown",
        messageId: regexResult?.metadata.messageId || this.generateMessageId(""),
        confidenceScore: mlResult.confidence,
        parsedAt: new Date().toISOString(),
      },
    }
  }

  /**
   * Generate message ID for fallback
   */
  private generateMessageId(message: string): string {
    let hash = 0
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
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
export const hybridParser = new HybridTransactionParser()
