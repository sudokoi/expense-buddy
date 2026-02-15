/**
 * Merchant Learning Engine
 *
 * Learns from user corrections to improve merchant categorization
 */

import AsyncStorage from "@react-native-async-storage/async-storage"
import { Expense } from "../../types/expense"
import {
  MerchantPattern,
  UserCorrection,
  SimilarityMatch,
  MerchantSuggestion,
} from "../../types/merchant-patterns"
import { ParsedTransaction } from "../../types/sms-import"
import { STORAGE_KEYS, LEARNING_THRESHOLDS, TIME_WINDOWS } from "./constants"
import { duplicateDetector } from "./duplicate-detector"

export class MerchantLearningEngine {
  private patterns: Map<string, MerchantPattern> = new Map()
  private corrections: UserCorrection[] = []

  /**
   * Initialize the learning engine from storage
   */
  async initialize(): Promise<void> {
    await Promise.all([this.loadPatterns(), this.loadCorrections()])
  }

  /**
   * Get suggestion for a merchant
   */
  async suggest(merchant: string): Promise<MerchantSuggestion | null> {
    const normalized = this.normalizeMerchant(merchant)

    // Check for exact match
    const exactPattern = this.patterns.get(normalized)
    if (
      exactPattern &&
      exactPattern.confidence > LEARNING_THRESHOLDS.MIN_PATTERN_CONFIDENCE
    ) {
      return {
        category: exactPattern.category,
        paymentMethod: exactPattern.paymentMethod,
        instrument: exactPattern.paymentInstrument,
        confidence: exactPattern.confidence,
      }
    }

    // Check for similar merchants
    const similar = await this.findSimilarMerchants(normalized)
    if (
      similar.length > 0 &&
      similar[0].similarity > LEARNING_THRESHOLDS.MIN_SIMILARITY_MATCH
    ) {
      const bestMatch = similar[0]
      return {
        category: bestMatch.pattern.category,
        paymentMethod: bestMatch.pattern.paymentMethod,
        instrument: bestMatch.pattern.paymentInstrument,
        confidence: bestMatch.similarity * bestMatch.pattern.confidence,
      }
    }

    // Check user corrections
    const correction = this.corrections.find(
      (c) => this.normalizeMerchant(c.originalMerchant) === normalized && c.applyToFuture
    )
    if (correction) {
      return {
        category: correction.correctedCategory,
        paymentMethod: correction.correctedPaymentMethod,
        instrument: correction.correctedInstrument,
        confidence: 0.9,
      }
    }

    return null
  }

  /**
   * Learn from an expense
   */
  async learnFromExpense(expense: Expense, parsed: ParsedTransaction): Promise<void> {
    const normalized = this.normalizeMerchant(parsed.merchant)
    const existingPattern = this.patterns.get(normalized)

    if (existingPattern) {
      // Check if should overwrite
      const shouldOverwrite = this.shouldOverwritePattern(
        existingPattern,
        expense,
        parsed
      )

      if (shouldOverwrite) {
        // Overwrite with new representation
        existingPattern.rawPatterns = [parsed.merchant]
        existingPattern.category = expense.category
        existingPattern.paymentMethod = expense.paymentMethod?.type || "Other"
        existingPattern.paymentInstrument = undefined // Would need instrument lookup
        existingPattern.userOverridden = expense.importMetadata?.userCorrected || false
        existingPattern.confidence = expense.importMetadata?.userCorrected ? 0.9 : 0.5
        existingPattern.usageCount = 1
        existingPattern.lastUsed = new Date().toISOString()
      } else {
        // Update existing
        existingPattern.usageCount++
        existingPattern.lastUsed = new Date().toISOString()

        if (expense.importMetadata?.userCorrected) {
          existingPattern.category = expense.category
          existingPattern.paymentMethod = expense.paymentMethod?.type || "Other"
          existingPattern.paymentInstrument = undefined
          existingPattern.userOverridden = true
          existingPattern.confidence = 1.0
        } else {
          existingPattern.confidence = Math.min(
            existingPattern.confidence + LEARNING_THRESHOLDS.CONFIRMATION_BOOST,
            LEARNING_THRESHOLDS.MAX_CONFIDENCE
          )
        }

        if (!existingPattern.rawPatterns.includes(parsed.merchant)) {
          existingPattern.rawPatterns.push(parsed.merchant)
        }
      }
    } else {
      // Create new pattern
      const newPattern: MerchantPattern = {
        id: this.generateId(),
        normalizedName: normalized,
        rawPatterns: [parsed.merchant],
        category: expense.category,
        paymentMethod: expense.paymentMethod?.type || "Other",
        paymentInstrument: undefined,
        confidence: expense.importMetadata?.userCorrected ? 0.9 : 0.5,
        usageCount: 1,
        lastUsed: new Date().toISOString(),
        userOverridden: expense.importMetadata?.userCorrected || false,
      }

      this.patterns.set(normalized, newPattern)
    }

    await this.savePatterns()
  }

  /**
   * Add a user correction
   */
  async addCorrection(correction: UserCorrection): Promise<void> {
    this.corrections.push(correction)
    await this.saveCorrections()

    // Apply correction immediately
    const normalized = this.normalizeMerchant(correction.originalMerchant)
    const pattern = this.patterns.get(normalized) || {
      id: this.generateId(),
      normalizedName: normalized,
      rawPatterns: [correction.originalMerchant],
      category: correction.correctedCategory || "Other",
      paymentMethod: correction.correctedPaymentMethod || "Other",
      paymentInstrument: correction.correctedInstrument,
      confidence: 0.9,
      usageCount: 1,
      lastUsed: new Date().toISOString(),
      userOverridden: true,
    }

    this.patterns.set(normalized, pattern)
    await this.savePatterns()
  }

  /**
   * Normalize merchant name
   */
  private normalizeMerchant(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .replace(/(pvt|ltd|inc|llc|corp|limited)/g, "")
      .trim()
  }

  /**
   * Check if pattern should be overwritten
   */
  private shouldOverwritePattern(
    existing: MerchantPattern,
    expense: Expense,
    _parsed: ParsedTransaction
  ): boolean {
    // Check category match
    if (existing.category !== expense.category) {
      return false
    }

    // Check amount within 10%
    // Note: In real implementation, we'd need to store amount in pattern
    // For now, simplified check

    // Check 24-hour window
    const timeDiff = Math.abs(
      new Date().getTime() - new Date(existing.lastUsed).getTime()
    )
    if (timeDiff > TIME_WINDOWS.PATTERN_OVERWRITE_WINDOW) {
      return false
    }

    return true
  }

  /**
   * Find similar merchants
   */
  private async findSimilarMerchants(normalized: string): Promise<SimilarityMatch[]> {
    const matches: SimilarityMatch[] = []

    for (const [name, pattern] of this.patterns) {
      const similarity = duplicateDetector.calculateSimilarity(normalized, name)
      if (similarity > LEARNING_THRESHOLDS.MIN_FUZZY_MATCH) {
        matches.push({ merchant: name, similarity, pattern })
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity)
  }

  /**
   * Load patterns from storage
   */
  private async loadPatterns(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.MERCHANT_PATTERNS)
      if (stored) {
        const patterns: MerchantPattern[] = JSON.parse(stored)
        this.patterns = new Map(patterns.map((p) => [p.normalizedName, p]))
      }
    } catch (error) {
      console.error("Failed to load merchant patterns:", error)
    }
  }

  /**
   * Save patterns to storage
   */
  private async savePatterns(): Promise<void> {
    try {
      const patternsArray = Array.from(this.patterns.values())
      await AsyncStorage.setItem(
        STORAGE_KEYS.MERCHANT_PATTERNS,
        JSON.stringify(patternsArray)
      )
    } catch (error) {
      console.error("Failed to save merchant patterns:", error)
    }
  }

  /**
   * Load corrections from storage
   */
  private async loadCorrections(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.USER_CORRECTIONS)
      if (stored) {
        this.corrections = JSON.parse(stored)
      }
    } catch (error) {
      console.error("Failed to load user corrections:", error)
    }
  }

  /**
   * Save corrections to storage
   */
  private async saveCorrections(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_CORRECTIONS,
        JSON.stringify(this.corrections)
      )
    } catch (error) {
      console.error("Failed to save user corrections:", error)
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get all patterns (for sync)
   */
  async getAllPatterns(): Promise<MerchantPattern[]> {
    return Array.from(this.patterns.values())
  }

  /**
   * Get all corrections (for sync)
   */
  async getAllCorrections(): Promise<UserCorrection[]> {
    return [...this.corrections]
  }
}

// Singleton instance
export const merchantLearningEngine = new MerchantLearningEngine()
