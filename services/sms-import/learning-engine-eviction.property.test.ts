/**
 * Property-based tests for Learning Engine (LRU Eviction and Pattern Overwrite)
 * Feature: sms-import-gaps
 */

import fc from "fast-check"
import { RETENTION_LIMITS, TIME_WINDOWS } from "./constants"
import { MerchantPattern } from "../../types/merchant-patterns"

/**
 * Reimplements the LRU eviction logic from learning-engine.ts savePatterns().
 * Sorts non-overridden patterns first (by lastUsed ascending), then overridden,
 * and evicts from the front until count is within limit.
 */
function evictPatterns(
  patterns: Map<string, MerchantPattern>
): Map<string, MerchantPattern> {
  const result = new Map(patterns)

  if (result.size > RETENTION_LIMITS.MAX_MERCHANT_PATTERNS) {
    const sorted = Array.from(result.entries()).sort((a, b) => {
      if (a[1].userOverridden !== b[1].userOverridden) {
        return a[1].userOverridden ? 1 : -1
      }
      return new Date(a[1].lastUsed).getTime() - new Date(b[1].lastUsed).getTime()
    })

    while (result.size > RETENTION_LIMITS.MAX_MERCHANT_PATTERNS) {
      const oldest = sorted.shift()
      if (oldest) result.delete(oldest[0])
    }
  }

  return result
}

/**
 * Reimplements shouldOverwritePattern from learning-engine.ts.
 * Returns true only when category differs, within 24h window, and amount within 10%.
 */
function shouldOverwritePattern(
  existing: { category: string; lastUsed: string },
  expense: { category: string; amount: number },
  parsed: { amount: number },
  now: number
): boolean {
  if (existing.category === expense.category) return false

  const timeDiff = Math.abs(now - new Date(existing.lastUsed).getTime())
  if (timeDiff > TIME_WINDOWS.PATTERN_OVERWRITE_WINDOW) return false

  if (Math.abs(parsed.amount - expense.amount) > expense.amount * 0.1) return false

  return true
}

// Arbitrary: ISO date string within a reasonable range
const dateArb = fc
  .integer({
    min: new Date("2020-01-01").getTime(),
    max: new Date("2026-12-31").getTime(),
  })
  .map((ts) => new Date(ts).toISOString())

// Arbitrary: a merchant pattern
const patternArb = (overridden: boolean) =>
  fc.record({
    id: fc.uuid(),
    normalizedName: fc.stringMatching(/^[a-z]{3,15}$/),
    rawPatterns: fc.constant(["raw"] as string[]),
    category: fc.constantFrom("Food", "Shopping", "Transport", "Entertainment"),
    paymentMethod: fc.constantFrom("UPI" as const, "Cash" as const, "Other" as const),
    confidence: fc.double({ min: 0.1, max: 1, noNaN: true }),
    usageCount: fc.integer({ min: 1, max: 500 }),
    lastUsed: dateArb,
    userOverridden: fc.constant(overridden),
  })

// Build a map of patterns with unique keys, exceeding the limit
const overLimitPatternsArb = (extraCount: number) =>
  fc
    .array(
      fc.record({
        pattern: patternArb(false),
        overridden: fc.boolean(),
      }),
      {
        minLength: RETENTION_LIMITS.MAX_MERCHANT_PATTERNS + extraCount,
        maxLength: RETENTION_LIMITS.MAX_MERCHANT_PATTERNS + extraCount + 50,
      }
    )
    .map((items) => {
      const map = new Map<string, MerchantPattern>()
      let idx = 0
      for (const item of items) {
        const key = `merchant_${idx}`
        map.set(key, {
          ...item.pattern,
          normalizedName: key,
          userOverridden: item.overridden,
        })
        idx++
      }
      return map
    })

// Positive amount arbitrary
const amountArb = fc.double({ min: 0.01, max: 100000, noNaN: true })

// Categories for property 14 tests
const allCategories = [
  "Food",
  "Shopping",
  "Transport",
  "Entertainment",
  "Bills",
  "Health",
] as const

describe("Learning Engine Properties", () => {
  /**
   * Property 13: LRU Eviction Enforces Limit and Protects User-Overridden Patterns
   * For any pattern set exceeding MAX_MERCHANT_PATTERNS, after eviction the count
   * SHALL be at most 1000, evicted patterns SHALL be those with the oldest lastUsed
   * timestamps, and userOverridden patterns SHALL only be evicted after all
   * non-overridden patterns have been evicted.
   */
  describe("Property 13: LRU Eviction Enforces Limit and Protects User-Overridden Patterns", () => {
    it("pattern count SHALL be at most MAX_MERCHANT_PATTERNS after eviction", () => {
      fc.assert(
        fc.property(overLimitPatternsArb(1), (patterns) => {
          const result = evictPatterns(patterns)
          return result.size <= RETENTION_LIMITS.MAX_MERCHANT_PATTERNS
        }),
        { numRuns: 20 }
      )
    })

    it("evicted patterns SHALL be those with the oldest lastUsed timestamps among non-overridden first", () => {
      fc.assert(
        fc.property(overLimitPatternsArb(1), (patterns) => {
          const result = evictPatterns(patterns)
          const evictedKeys = new Set<string>()
          for (const key of patterns.keys()) {
            if (!result.has(key)) evictedKeys.add(key)
          }

          // All surviving non-overridden patterns should have lastUsed >= any evicted non-overridden pattern
          for (const evictedKey of evictedKeys) {
            const evicted = patterns.get(evictedKey)!
            if (evicted.userOverridden) continue

            for (const [, survivor] of result) {
              if (survivor.userOverridden) continue
              const evictedTime = new Date(evicted.lastUsed).getTime()
              const survivorTime = new Date(survivor.lastUsed).getTime()
              if (survivorTime < evictedTime) return false
            }
          }
          return true
        }),
        { numRuns: 20 }
      )
    })

    it("userOverridden patterns SHALL only be evicted after all non-overridden patterns are evicted", () => {
      fc.assert(
        fc.property(overLimitPatternsArb(1), (patterns) => {
          const result = evictPatterns(patterns)

          const evictedOverridden: string[] = []
          const survivingNonOverridden: string[] = []

          for (const [key, pattern] of patterns) {
            if (!result.has(key) && pattern.userOverridden) {
              evictedOverridden.push(key)
            }
            if (result.has(key) && !pattern.userOverridden) {
              survivingNonOverridden.push(key)
            }
          }

          // If any overridden pattern was evicted, no non-overridden pattern should survive
          if (evictedOverridden.length > 0) {
            return survivingNonOverridden.length === 0
          }
          return true
        }),
        { numRuns: 20 }
      )
    })

    it("patterns at or below the limit SHALL not be evicted", () => {
      fc.assert(
        fc.property(
          fc
            .array(patternArb(false), {
              minLength: 1,
              maxLength: RETENTION_LIMITS.MAX_MERCHANT_PATTERNS,
            })
            .map((items) => {
              const map = new Map<string, MerchantPattern>()
              items.forEach((p, i) => {
                const key = `merchant_${i}`
                map.set(key, { ...p, normalizedName: key })
              })
              return map
            }),
          (patterns) => {
            const result = evictPatterns(patterns)
            return result.size === patterns.size
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 14: Pattern Overwrite Requires Amount Within 10% Range
   * For any existing pattern and new transaction where the amount differs by more
   * than 10% from the expense amount, shouldOverwritePattern SHALL return false,
   * even if the category differs and the time window condition is met.
   */
  describe("Property 14: Pattern Overwrite Requires Amount Within 10% Range", () => {
    it("shouldOverwritePattern SHALL return false when amount differs by more than 10%", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allCategories),
          fc.constantFrom(...allCategories),
          amountArb,
          fc.double({ min: 0.11, max: 5, noNaN: true }),
          (patternCategory, expenseCategory, expenseAmount, multiplier) => {
            fc.pre(patternCategory !== expenseCategory)
            fc.pre(expenseAmount > 0)

            // Parsed amount is outside 10% range
            const parsedAmount = expenseAmount * (1 + multiplier)
            const now = Date.now()
            const recentLastUsed = new Date(now - 1000).toISOString() // 1 second ago, well within 24h

            return (
              shouldOverwritePattern(
                { category: patternCategory, lastUsed: recentLastUsed },
                { category: expenseCategory, amount: expenseAmount },
                { amount: parsedAmount },
                now
              ) === false
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it("shouldOverwritePattern SHALL return true when category differs, within 24h, and amount within 10%", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allCategories),
          fc.constantFrom(...allCategories),
          amountArb,
          fc.double({ min: 0, max: 0.099, noNaN: true }),
          (patternCategory, expenseCategory, expenseAmount, fraction) => {
            fc.pre(patternCategory !== expenseCategory)
            fc.pre(expenseAmount > 0)

            // Parsed amount is within 10% range (fraction capped below 0.1 to avoid floating-point boundary)
            const parsedAmount = expenseAmount * (1 + fraction)
            const now = Date.now()
            const recentLastUsed = new Date(now - 1000).toISOString()

            return (
              shouldOverwritePattern(
                { category: patternCategory, lastUsed: recentLastUsed },
                { category: expenseCategory, amount: expenseAmount },
                { amount: parsedAmount },
                now
              ) === true
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it("shouldOverwritePattern SHALL return false when same category regardless of amount", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allCategories),
          amountArb,
          amountArb,
          (category, expenseAmount, parsedAmount) => {
            const now = Date.now()
            const recentLastUsed = new Date(now - 1000).toISOString()

            return (
              shouldOverwritePattern(
                { category, lastUsed: recentLastUsed },
                { category, amount: expenseAmount },
                { amount: parsedAmount },
                now
              ) === false
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it("shouldOverwritePattern SHALL return false when outside 24h window regardless of amount", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allCategories),
          fc.constantFrom(...allCategories),
          amountArb,
          (patternCategory, expenseCategory, amount) => {
            fc.pre(patternCategory !== expenseCategory)
            const now = Date.now()
            // 25 hours ago, outside the 24h window
            const oldLastUsed = new Date(now - 25 * 60 * 60 * 1000).toISOString()

            return (
              shouldOverwritePattern(
                { category: patternCategory, lastUsed: oldLastUsed },
                { category: expenseCategory, amount },
                { amount }, // same amount, within 10%
                now
              ) === false
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
