import { calculateStatistics } from "./statistics"
import type { Expense } from "../../types/expense"

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: overrides.id ?? `exp-${Math.random().toString(36).slice(2, 9)}`,
    amount: overrides.amount ?? 100,
    category: overrides.category ?? "Food",
    date: overrides.date ?? new Date().toISOString(),
    note: overrides.note ?? "",
    paymentMethod: overrides.paymentMethod,
    currency: overrides.currency,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  }
}

describe("calculateStatistics", () => {
  it("computes total spending with absolute amounts", () => {
    const expenses = [makeExpense({ amount: 100 }), makeExpense({ amount: -50 })]
    const stats = calculateStatistics(expenses, 7)
    expect(stats.totalSpending).toBe(150)
    expect(stats.averageDaily).toBeCloseTo(150 / 7)
  })

  it("finds the highest category and highest day", () => {
    const expenses = [
      makeExpense({
        category: "Food",
        amount: 300,
        date: new Date(2026, 6, 1, 10).toISOString(),
      }),
      makeExpense({
        category: "Transport",
        amount: 200,
        date: new Date(2026, 6, 1, 12).toISOString(),
      }),
      makeExpense({
        category: "Food",
        amount: 600,
        date: new Date(2026, 6, 2, 10).toISOString(),
      }),
    ]
    const stats = calculateStatistics(expenses, 7)
    expect(stats.highestCategory?.category).toBe("Food")
    expect(stats.highestCategory?.amount).toBe(900)
    expect(stats.highestDay?.date).toBe("2026-07-02")
    expect(stats.highestDay?.amount).toBe(600)
  })

  it("returns nulls for empty expenses", () => {
    const stats = calculateStatistics([], 7)
    expect(stats.totalSpending).toBe(0)
    expect(stats.averageDaily).toBe(0)
    expect(stats.highestCategory).toBeNull()
    expect(stats.highestDay).toBeNull()
  })

  describe("fullPeriodTotalSpending", () => {
    it("is unset when no full-period expenses are provided", () => {
      const stats = calculateStatistics([makeExpense({ amount: 100 })], 7)
      expect(stats.fullPeriodTotalSpending).toBeUndefined()
    })

    it("is computed from the full-period expenses", () => {
      const filtered = [makeExpense({ amount: 100 }), makeExpense({ amount: 50 })]
      const fullPeriod = [
        makeExpense({ amount: 100 }),
        makeExpense({ amount: 50 }),
        makeExpense({ amount: 250 }),
      ]
      const stats = calculateStatistics(filtered, 7, fullPeriod)
      expect(stats.totalSpending).toBe(150)
      expect(stats.fullPeriodTotalSpending).toBe(400)
    })

    it("uses absolute amounts", () => {
      const filtered = [makeExpense({ amount: -100 })]
      const fullPeriod = [makeExpense({ amount: -100 }), makeExpense({ amount: -50 })]
      const stats = calculateStatistics(filtered, 7, fullPeriod)
      expect(stats.fullPeriodTotalSpending).toBe(150)
    })

    it("differs from the headline total when only a time window is active", () => {
      // Time-only filter: headline is scoped to the period, but the full-period
      // (grand) total comes from ALL currency expenses and must differ so the
      // subtext stays visible instead of being hidden as redundant.
      const timeWindow = [makeExpense({ amount: 100 }), makeExpense({ amount: 50 })]
      const allCurrency = [
        makeExpense({ amount: 100 }),
        makeExpense({ amount: 50 }),
        makeExpense({ amount: 400 }),
      ]
      const stats = calculateStatistics(timeWindow, 30, allCurrency)
      expect(stats.totalSpending).toBe(150)
      expect(stats.fullPeriodTotalSpending).toBe(550)
      expect(stats.fullPeriodTotalSpending).not.toBe(stats.totalSpending)
    })
  })
})
