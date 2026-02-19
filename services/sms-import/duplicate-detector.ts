/**
 * Duplicate Detector
 *
 * Prevents duplicate expense imports using fingerprinting and similarity detection
 */

import AsyncStorage from "@react-native-async-storage/async-storage"
import { isSameDay, parseISO } from "date-fns"
import { ParsedTransaction, DuplicateCheck } from "../../types/sms-import"
import { expenseStore } from "../../stores/expense-store"
import { getActiveExpenses } from "../../stores/expense-store"
import { STORAGE_KEYS, RETENTION_LIMITS, DUPLICATE_THRESHOLDS } from "./constants"

export class DuplicateDetector {
  private processedIds: Set<string> = new Set()

  /**
   * Initialize the duplicate detector from storage
   */
  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PROCESSED_MESSAGE_IDS)
      if (stored) {
        const ids: string[] = JSON.parse(stored)
        this.processedIds = new Set(ids)
      }
    } catch (error) {
      console.error("Failed to load processed message IDs:", error)
    }
  }

  /**
   * Check if a parsed transaction is a duplicate
   */
  async check(parsed: ParsedTransaction): Promise<DuplicateCheck> {
    // Check 1: Exact message ID match
    if (this.processedIds.has(parsed.metadata.messageId)) {
      return {
        isDuplicate: true,
        confidence: 1.0,
        reason: "message_id",
      }
    }

    // Check 2: Amount + Date + Merchant similarity
    const similarExists = await this.checkSimilarExists(parsed)
    if (similarExists) {
      return {
        isDuplicate: true,
        confidence: 0.9,
        reason: "amount_date_merchant",
      }
    }

    return {
      isDuplicate: false,
      confidence: 0,
      reason: "none",
    }
  }

  /**
   * Mark a message ID as processed
   */
  async markProcessed(messageId: string): Promise<void> {
    this.processedIds.add(messageId)

    // Keep only last N IDs
    const idsArray = Array.from(this.processedIds)
    if (idsArray.length > RETENTION_LIMITS.MAX_PROCESSED_IDS) {
      // Remove oldest IDs (first in array)
      const toRemove = idsArray.length - RETENTION_LIMITS.MAX_PROCESSED_IDS
      idsArray.slice(0, toRemove).forEach((id) => this.processedIds.delete(id))
    }

    // Persist to storage
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PROCESSED_MESSAGE_IDS,
        JSON.stringify(Array.from(this.processedIds))
      )
    } catch (error) {
      console.error("Failed to save processed message IDs:", error)
    }
  }

  /**
   * Check if a similar expense already exists by comparing amount, date, and merchant name
   */
  private async checkSimilarExists(parsed: ParsedTransaction): Promise<boolean> {
    const expenses = expenseStore.getSnapshot().context.expenses
    const activeExpenses = getActiveExpenses(expenses)
    const parsedDate = parseISO(parsed.date)

    const candidates = activeExpenses.filter((expense) => {
      const amountDiff = Math.abs(expense.amount - parsed.amount)
      const amountMatch =
        amountDiff <= parsed.amount * DUPLICATE_THRESHOLDS.AMOUNT_TOLERANCE
      const dateMatch = isSameDay(parseISO(expense.date), parsedDate)
      return amountMatch && dateMatch
    })

    return candidates.some((candidate) => {
      const similarity = this.calculateSimilarity(parsed.merchant, candidate.note)
      return similarity > DUPLICATE_THRESHOLDS.MERCHANT_SIMILARITY
    })
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  calculateSimilarity(a: string, b: string): number {
    const distance = this.levenshteinDistance(a.toLowerCase(), b.toLowerCase())
    const maxLength = Math.max(a.length, b.length)
    if (maxLength === 0) return 1
    return 1 - distance / maxLength
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          )
        }
      }
    }

    return matrix[b.length][a.length]
  }
}

// Singleton instance
export const duplicateDetector = new DuplicateDetector()
