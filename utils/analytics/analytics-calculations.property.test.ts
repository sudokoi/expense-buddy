/**
 * Property-based tests for Analytics Calculation Functions
 * Feature: codebase-improvements
 *
 * These tests verify that analytics calculations work correctly
 * for grouping, aggregations, and statistics.
 */

import * as fc from "fast-check"
import {
  groupExpensesByCurrency,
  getDateRangeForTimeWindow,
} from "../analytics-calculations"
import type { Expense } from "../../types/expense"

// Helper to generate test expenses
function generateExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: overrides.id ?? `exp-${Math.random().toString(36).substr(2, 9)}`,
    amount: overrides.amount ?? Math.random() * 1000,
    category: overrides.category ?? "Food",
    date: overrides.date ?? new Date().toISOString(),
    note: overrides.note ?? "",
    paymentMethod: overrides.paymentMethod,
    currency: overrides.currency,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  }
}

describe("groupExpensesByCurrency", () => {
  it("should group expenses by their currency field", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("INR", "USD", "EUR"), { minLength: 1, maxLength: 20 }),
        fc.constantFrom("INR", "USD", "EUR"),
        (currencies, fallbackCurrency) => {
          const expenses = currencies.map((currency, i) =>
            generateExpense({
              id: `exp-${i}`,
              currency,
            })
          )

          const grouped = groupExpensesByCurrency(expenses, fallbackCurrency)

          // Should have entries for each unique currency
          const uniqueCurrencies = [...new Set(currencies)]
          expect(grouped.size).toBe(uniqueCurrencies.length)

          // Each group should contain the correct expenses
          for (const currency of uniqueCurrencies) {
            const groupExpenses = grouped.get(currency) || []
            const expectedCount = currencies.filter((c) => c === currency).length
            expect(groupExpenses.length).toBe(expectedCount)
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should use fallback currency for expenses without currency", () => {
    const fallbackCurrency = "INR"
    const expenses = [
      generateExpense({ currency: undefined }),
      generateExpense({ currency: "USD" }),
      generateExpense({ currency: undefined }),
    ]

    const grouped = groupExpensesByCurrency(expenses, fallbackCurrency)

    // Should have 2 groups: fallback (INR) and USD
    expect(grouped.size).toBe(2)
    expect(grouped.get(fallbackCurrency)?.length).toBe(2)
    expect(grouped.get("USD")?.length).toBe(1)
  })

  it("should return empty map for empty expenses array", () => {
    const grouped = groupExpensesByCurrency([], "INR")
    expect(grouped.size).toBe(0)
  })
})

describe("getDateRangeForTimeWindow", () => {
  it("should return valid date range for all time windows", () => {
    const timeWindows = ["7d", "15d", "1m", "3m", "6m", "1y", "all"] as const

    for (const timeWindow of timeWindows) {
      const expenses = [generateExpense()]
      const range = getDateRangeForTimeWindow(timeWindow, expenses)

      expect(range.start).toBeInstanceOf(Date)
      expect(range.end).toBeInstanceOf(Date)
      expect(range.start.getTime()).toBeLessThanOrEqual(range.end.getTime())
    }
  })

  it("should handle empty expenses array", () => {
    const range = getDateRangeForTimeWindow("7d", [])

    expect(range.start).toBeInstanceOf(Date)
    expect(range.end).toBeInstanceOf(Date)
  })
})
