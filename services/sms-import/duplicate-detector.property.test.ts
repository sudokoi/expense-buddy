/**
 * Property-based tests for Duplicate Detector
 * Feature: sms-import-gaps
 */

import fc from "fast-check"
import { DUPLICATE_THRESHOLDS } from "./constants"

/**
 * Reimplements the Levenshtein distance calculation from duplicate-detector.ts
 * for pure property testing without store dependencies.
 */
function levenshteinDistance(a: string, b: string): number {
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

function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase())
  const maxLength = Math.max(a.length, b.length)
  if (maxLength === 0) return 1
  return 1 - distance / maxLength
}
interface SimpleExpense {
  amount: number
  date: string // ISO date string
  note: string // merchant name stored as note
}

interface SimpleParsedTransaction {
  amount: number
  date: string // ISO date string
  merchant: string
}

/**
 * Reimplements the checkSimilarExists logic from duplicate-detector.ts.
 * Returns true iff any expense matches same-day + 1% amount + merchant similarity > 0.85.
 */
function checkSimilarExists(
  parsed: SimpleParsedTransaction,
  expenses: SimpleExpense[]
): boolean {
  const parsedDate = new Date(parsed.date)

  const candidates = expenses.filter((expense) => {
    const amountDiff = Math.abs(expense.amount - parsed.amount)
    const amountMatch =
      amountDiff <= parsed.amount * DUPLICATE_THRESHOLDS.AMOUNT_TOLERANCE
    const expenseDate = new Date(expense.date)
    const dateMatch =
      parsedDate.getFullYear() === expenseDate.getFullYear() &&
      parsedDate.getMonth() === expenseDate.getMonth() &&
      parsedDate.getDate() === expenseDate.getDate()
    return amountMatch && dateMatch
  })

  return candidates.some((candidate) => {
    const similarity = calculateSimilarity(parsed.merchant, candidate.note)
    return similarity > DUPLICATE_THRESHOLDS.MERCHANT_SIMILARITY
  })
}

// Arbitrary: positive amounts (avoid zero to make tolerance meaningful)
const amountArb = fc.double({ min: 1, max: 100000, noNaN: true })

// Arbitrary: date as ISO string within a reasonable range
const dateArb = fc
  .integer({
    min: new Date("2020-01-01").getTime(),
    max: new Date("2026-12-31").getTime(),
  })
  .map((ts) => new Date(ts).toISOString())

// Arbitrary: merchant names (non-empty alpha strings)
const merchantArb = fc.stringMatching(/^[a-zA-Z ]{1,30}$/)

// Arbitrary: a simple expense
const expenseArb = fc.record({
  amount: amountArb,
  date: dateArb,
  note: merchantArb,
})

// Arbitrary: a simple parsed transaction
const parsedArb = fc.record({
  amount: amountArb,
  date: dateArb,
  merchant: merchantArb,
})
describe("Duplicate Detector Properties", () => {
  /**
   * Property 4: Duplicate Detection by Amount, Date, and Merchant Similarity
   * For any parsed transaction and expense set, duplicate SHALL be flagged
   * iff there exists an expense on the same day with amount within 1% tolerance
   * and merchant name Levenshtein similarity exceeding 0.85.
   */
  describe("Property 4: Duplicate Detection by Amount, Date, and Merchant Similarity", () => {
    it("duplicate SHALL be flagged iff same-day + 1% amount + merchant similarity > 0.85", () => {
      fc.assert(
        fc.property(
          parsedArb,
          fc.array(expenseArb, { maxLength: 20 }),
          (parsed, expenses) => {
            const result = checkSimilarExists(parsed, expenses)

            // Compute expected result independently
            const parsedDate = new Date(parsed.date)
            const expected = expenses.some((expense) => {
              const expenseDate = new Date(expense.date)
              const sameDay =
                parsedDate.getFullYear() === expenseDate.getFullYear() &&
                parsedDate.getMonth() === expenseDate.getMonth() &&
                parsedDate.getDate() === expenseDate.getDate()
              const amountDiff = Math.abs(expense.amount - parsed.amount)
              const amountMatch =
                amountDiff <= parsed.amount * DUPLICATE_THRESHOLDS.AMOUNT_TOLERANCE
              const similarity = calculateSimilarity(parsed.merchant, expense.note)
              const merchantMatch = similarity > DUPLICATE_THRESHOLDS.MERCHANT_SIMILARITY
              return sameDay && amountMatch && merchantMatch
            })

            return result === expected
          }
        ),
        { numRuns: 100 }
      )
    })

    it("identical merchant, same day, same amount SHALL always be flagged as duplicate", () => {
      fc.assert(
        fc.property(merchantArb, amountArb, dateArb, (merchant, amount, date) => {
          fc.pre(merchant.length > 0)
          const parsed: SimpleParsedTransaction = { amount, date, merchant }
          const expenses: SimpleExpense[] = [{ amount, date, note: merchant }]
          return checkSimilarExists(parsed, expenses) === true
        }),
        { numRuns: 100 }
      )
    })

    it("completely different merchants SHALL NOT be flagged even with same amount and date", () => {
      fc.assert(
        fc.property(amountArb, dateArb, (amount, date) => {
          const parsed: SimpleParsedTransaction = { amount, date, merchant: "aaaaaaa" }
          const expenses: SimpleExpense[] = [{ amount, date, note: "zzzzzzz" }]
          return checkSimilarExists(parsed, expenses) === false
        }),
        { numRuns: 100 }
      )
    })

    it("amount outside 1% tolerance SHALL NOT be flagged even with same merchant and date", () => {
      fc.assert(
        fc.property(merchantArb, amountArb, dateArb, (merchant, amount, date) => {
          fc.pre(merchant.length > 0)
          fc.pre(amount > 10) // ensure tolerance gap is meaningful
          // Set expense amount to be clearly outside 1% tolerance
          const expenseAmount = amount * 1.02 // 2% higher, well beyond 1%
          const parsed: SimpleParsedTransaction = { amount, date, merchant }
          const expenses: SimpleExpense[] = [
            { amount: expenseAmount, date, note: merchant },
          ]
          return checkSimilarExists(parsed, expenses) === false
        }),
        { numRuns: 100 }
      )
    })

    it("different day SHALL NOT be flagged even with same merchant and amount", () => {
      fc.assert(
        fc.property(merchantArb, amountArb, (merchant, amount) => {
          fc.pre(merchant.length > 0)
          const parsed: SimpleParsedTransaction = {
            amount,
            date: "2025-06-15T10:00:00.000Z",
            merchant,
          }
          const expenses: SimpleExpense[] = [
            { amount, date: "2025-06-16T10:00:00.000Z", note: merchant },
          ]
          return checkSimilarExists(parsed, expenses) === false
        }),
        { numRuns: 100 }
      )
    })
  })
})
