/**
 * Property-based tests for Analytics Filter Functions
 * Feature: codebase-improvements
 *
 * These tests verify that the filter functions correctly filter expenses
 * based on various criteria including time window, categories, payment methods,
 * payment instruments, search queries, and amount ranges.
 */

import * as fc from "fast-check"
import {
  applyAllFilters,
  resolveInstrumentKeyForExpense,
  filterExpensesByCategories,
  filterExpensesByPaymentMethods,
  filterExpensesByAmountRange,
  makePaymentInstrumentSelectionKey,
} from "./filters"
import type { Expense } from "../../types/expense"
import type { PaymentInstrument } from "../../types/payment-instrument"
import type { FilterState } from "./filters"

// ============================================================================
// Test Data Generators
// ============================================================================

const categories = ["Food", "Transport", "Shopping", "Entertainment", "Bills", "Other"]

// Generate a valid expense object
function generateExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: overrides.id ?? `exp-${Math.random().toString(36).substr(2, 9)}`,
    amount: overrides.amount || Math.random() * 1000,
    category:
      overrides.category || categories[Math.floor(Math.random() * categories.length)],
    date: overrides.date || new Date().toISOString(),
    note: overrides.note ?? "",
    paymentMethod: overrides.paymentMethod,
    currency: overrides.currency,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  }
}

// Generate a valid payment instrument
function generateInstrument(
  overrides: Partial<PaymentInstrument> = {}
): PaymentInstrument {
  return {
    id: overrides.id || `inst-${Math.random().toString(36).substr(2, 9)}`,
    method: (overrides.method || "Credit Card") as PaymentInstrument["method"],
    nickname: overrides.nickname || "Test Card",
    lastDigits: overrides.lastDigits || "1234",
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    deletedAt: overrides.deletedAt,
  }
}

// ============================================================================
// Property Tests
// ============================================================================

describe("applyAllFilters", () => {
  it("should return all expenses when no filters are active", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 50 })), (indices) => {
        const expenses = indices.map((_, i) => generateExpense({ id: `exp-${i}` }))
        const filterState: FilterState = {
          timeWindow: "all",
          selectedCategories: [],
          selectedPaymentMethods: [],
          selectedPaymentInstruments: [],
          searchQuery: "",
          minAmount: null,
          maxAmount: null,
        }

        const result = applyAllFilters(expenses, filterState, [])

        // Should return same expenses (possibly different array reference)
        expect(result.length).toBe(expenses.length)
        expect(result.map((e) => e.id).sort()).toEqual(expenses.map((e) => e.id).sort())

        return true
      }),
      { numRuns: 100 }
    )
  })

  it("should filter by categories correctly", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 50 })),
        fc.constantFrom(...categories),
        (indices, targetCategory) => {
          const expenses = indices.map((_, i) =>
            generateExpense({
              id: `exp-${i}`,
              category: i % 3 === 0 ? targetCategory : categories[i % categories.length],
            })
          )

          const filterState: FilterState = {
            timeWindow: "all",
            selectedCategories: [targetCategory],
            selectedPaymentMethods: [],
            selectedPaymentInstruments: [],
            searchQuery: "",
            minAmount: null,
            maxAmount: null,
          }

          const result = applyAllFilters(expenses, filterState, [])

          // All results should have the target category
          expect(result.every((e) => e.category === targetCategory)).toBe(true)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should filter by amount range correctly", () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 0, max: 2000, noNaN: true }), {
          minLength: 1,
          maxLength: 50,
        }),
        fc.float({ min: 100, max: 500, noNaN: true }),
        fc.float({ min: 600, max: 1000, noNaN: true }),
        (amounts, minAmount, maxAmount) => {
          const expenses = amounts.map((amount, i) =>
            generateExpense({
              id: `exp-${i}`,
              amount,
            })
          )

          const filterState: FilterState = {
            timeWindow: "all",
            selectedCategories: [],
            selectedPaymentMethods: [],
            selectedPaymentInstruments: [],
            searchQuery: "",
            minAmount,
            maxAmount,
          }

          const result = applyAllFilters(expenses, filterState, [])

          // All results should be within amount range
          expect(
            result.every((e) => e.amount >= minAmount && e.amount <= maxAmount)
          ).toBe(true)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should handle multiple filters in combination", () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 0, max: 2000, noNaN: true }), {
          minLength: 5,
          maxLength: 50,
        }),
        fc.constantFrom(...categories),
        fc.float({ min: 100, max: 500, noNaN: true }),
        fc.float({ min: 600, max: 1000, noNaN: true }),
        (amounts, targetCategory, minAmount, maxAmount) => {
          const expenses = amounts.map((amount, i) =>
            generateExpense({
              id: `exp-${i}`,
              amount,
              category: i % 2 === 0 ? targetCategory : categories[i % categories.length],
            })
          )

          const filterState: FilterState = {
            timeWindow: "all",
            selectedCategories: [targetCategory],
            selectedPaymentMethods: [],
            selectedPaymentInstruments: [],
            searchQuery: "",
            minAmount,
            maxAmount,
          }

          const result = applyAllFilters(expenses, filterState, [])

          // Result should be a subset of original expenses
          expect(result.length).toBeLessThanOrEqual(expenses.length)

          // All results should satisfy category filter
          expect(result.every((e) => e.category === targetCategory)).toBe(true)

          // All results should satisfy amount filter
          expect(
            result.every((e) => e.amount >= minAmount && e.amount <= maxAmount)
          ).toBe(true)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe("resolveInstrumentKeyForExpense", () => {
  it("should return null for non-instrument payment methods", () => {
    const expense = generateExpense({
      paymentMethod: { type: "Cash" },
    })

    const result = resolveInstrumentKeyForExpense(expense, [])

    expect(result).toBeNull()
  })

  it("should return key with isOther=true for missing instruments", () => {
    const expense = generateExpense({
      paymentMethod: {
        type: "Credit Card",
        instrumentId: "non-existent-id",
      },
    })

    const result = resolveInstrumentKeyForExpense(expense, [])

    expect(result).not.toBeNull()
    expect(result!.isOther).toBe(true)
    expect(result!.key).toContain("__others__")
  })

  it("should return key with isOther=false for valid instruments", () => {
    const instrument = generateInstrument({ deletedAt: undefined })
    const expense = generateExpense({
      paymentMethod: {
        type: instrument.method,
        instrumentId: instrument.id,
      },
    })

    const result = resolveInstrumentKeyForExpense(expense, [instrument])

    expect(result).not.toBeNull()
    expect(result!.isOther).toBe(false)
    expect(result!.instrumentId).toBe(instrument.id)
    expect(result!.key).toContain(instrument.id)
  })

  it("should return key with isOther=true for deleted instruments", () => {
    const instrument = generateInstrument({ deletedAt: new Date().toISOString() })
    const expense = generateExpense({
      paymentMethod: {
        type: instrument.method,
        instrumentId: instrument.id,
      },
    })

    const result = resolveInstrumentKeyForExpense(expense, [instrument])

    expect(result).not.toBeNull()
    expect(result!.isOther).toBe(true)
    expect(result!.key).toContain("__others__")
  })
})

describe("filterExpensesByCategories", () => {
  it("should return all expenses when no categories selected", () => {
    const expenses = [generateExpense(), generateExpense(), generateExpense()]

    const result = filterExpensesByCategories(expenses, [])

    expect(result).toEqual(expenses)
  })

  it("should only include expenses with selected categories", () => {
    const targetCategory = "Food"
    const expenses = [
      generateExpense({ category: targetCategory }),
      generateExpense({ category: "Transport" }),
      generateExpense({ category: targetCategory }),
    ]

    const result = filterExpensesByCategories(expenses, [targetCategory])

    expect(result.length).toBe(2)
    expect(result.every((e) => e.category === targetCategory)).toBe(true)
  })
})

describe("filterExpensesByPaymentMethods", () => {
  it("should return all expenses when no methods selected", () => {
    const expenses = [generateExpense(), generateExpense(), generateExpense()]

    const result = filterExpensesByPaymentMethods(expenses, [])

    expect(result).toEqual(expenses)
  })
})

describe("filterExpensesByAmountRange", () => {
  it("should filter by minimum amount", () => {
    const expenses = [
      generateExpense({ amount: 50 }),
      generateExpense({ amount: 150 }),
      generateExpense({ amount: 250 }),
    ]

    const result = filterExpensesByAmountRange(expenses, 100, null)

    expect(result.length).toBe(2)
    expect(result.every((e) => e.amount >= 100)).toBe(true)
  })

  it("should filter by maximum amount", () => {
    const expenses = [
      generateExpense({ amount: 50 }),
      generateExpense({ amount: 150 }),
      generateExpense({ amount: 250 }),
    ]

    const result = filterExpensesByAmountRange(expenses, null, 200)

    expect(result.length).toBe(2)
    expect(result.every((e) => e.amount <= 200)).toBe(true)
  })

  it("should filter by both min and max", () => {
    const expenses = [
      generateExpense({ amount: 50 }),
      generateExpense({ amount: 150 }),
      generateExpense({ amount: 250 }),
    ]

    const result = filterExpensesByAmountRange(expenses, 100, 200)

    expect(result.length).toBe(1)
    expect(result[0].amount).toBe(150)
  })
})

describe("makePaymentInstrumentSelectionKey", () => {
  it("should create consistent keys with instrument ID", () => {
    const key = makePaymentInstrumentSelectionKey("Credit Card", "inst-123")

    expect(key).toBe("Credit Card::inst-123")
  })

  it("should create keys with __others__ when no instrument ID", () => {
    const key = makePaymentInstrumentSelectionKey("Debit Card", undefined)

    expect(key).toBe("Debit Card::__others__")
  })
})
