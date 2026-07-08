import { computeDerivedExpenseData } from "../hooks/compute-derived-expense-data"
import type { Expense } from "../../types/expense"

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: Math.random().toString(36).slice(2),
    amount: 100,
    category: "food",
    date: "2026-01-15T10:00:00.000Z",
    note: "",
    createdAt: "2026-01-15T10:00:00.000Z",
    updatedAt: "2026-01-15T10:00:00.000Z",
    ...overrides,
  }
}

describe("computeDerivedExpenseData", () => {
  it("groups expenses by currency and sorts available currencies", () => {
    const activeExpenses = [
      makeExpense({ id: "1", currency: "USD", date: "2026-01-10T00:00:00.000Z" }),
      makeExpense({ id: "2", currency: "INR", date: "2026-01-11T00:00:00.000Z" }),
      makeExpense({ id: "3", currency: "USD", date: "2026-01-12T00:00:00.000Z" }),
    ]

    const result = computeDerivedExpenseData(activeExpenses, "INR", null, null, false)

    expect(result.availableCurrencies).toEqual(["INR", "USD"])
    expect(result.expensesByCurrency.get("USD")).toHaveLength(2)
    expect(result.expensesByCurrency.get("INR")).toHaveLength(1)
  })

  it("falls back to the default currency for expenses without a currency", () => {
    const activeExpenses = [
      makeExpense({ id: "1", currency: undefined, date: "2026-01-10T00:00:00.000Z" }),
      makeExpense({ id: "2", currency: "USD", date: "2026-01-11T00:00:00.000Z" }),
    ]

    const result = computeDerivedExpenseData(activeExpenses, "INR", null, null, false)

    expect(result.availableCurrencies).toEqual(["INR", "USD"])
    expect(result.expensesByCurrency.get("INR")).toHaveLength(1)
  })

  it("resolves effectiveCurrency to the user selection when available", () => {
    const activeExpenses = [
      makeExpense({ id: "1", currency: "INR", date: "2026-01-10T00:00:00.000Z" }),
      makeExpense({ id: "2", currency: "USD", date: "2026-01-11T00:00:00.000Z" }),
    ]

    const result = computeDerivedExpenseData(activeExpenses, "INR", "USD", null, false)

    expect(result.effectiveCurrency).toBe("USD")
    expect(result.currencyExpenses).toEqual(result.expensesByCurrency.get("USD"))
  })

  it("auto-selects the only available currency when no selection is made", () => {
    const activeExpenses = [
      makeExpense({ id: "1", currency: "INR", date: "2026-01-10T00:00:00.000Z" }),
    ]

    const result = computeDerivedExpenseData(activeExpenses, "INR", null, null, false)

    expect(result.effectiveCurrency).toBe("INR")
  })

  it("lists months for the effective currency, newest first", () => {
    const activeExpenses = [
      makeExpense({ id: "1", currency: "INR", date: "2026-03-05T00:00:00.000Z" }),
      makeExpense({ id: "2", currency: "INR", date: "2026-01-20T00:00:00.000Z" }),
      makeExpense({ id: "3", currency: "INR", date: "2026-01-08T00:00:00.000Z" }),
    ]

    const result = computeDerivedExpenseData(activeExpenses, "INR", null, null, false)

    expect(result.availableMonths).toEqual(["2026-03", "2026-01"])
  })

  it("scopes available months to the effective currency only", () => {
    const activeExpenses = [
      makeExpense({ id: "1", currency: "INR", date: "2026-01-10T00:00:00.000Z" }),
      makeExpense({ id: "2", currency: "USD", date: "2026-02-10T00:00:00.000Z" }),
    ]

    const result = computeDerivedExpenseData(activeExpenses, "INR", "USD", null, false)

    expect(result.availableMonths).toEqual(["2026-02"])
  })

  it("resolves effectiveSelectedMonth to the stored month when it exists for the currency", () => {
    const activeExpenses = [
      makeExpense({ id: "1", currency: "INR", date: "2026-01-10T00:00:00.000Z" }),
      makeExpense({ id: "2", currency: "INR", date: "2026-03-10T00:00:00.000Z" }),
    ]

    const result = computeDerivedExpenseData(
      activeExpenses,
      "INR",
      null,
      "2026-03",
      false
    )

    expect(result.effectiveSelectedMonth).toBe("2026-03")
  })

  it("resolves effectiveSelectedMonth to null when the stored month has no data for the currency", () => {
    const activeExpenses = [
      makeExpense({ id: "1", currency: "INR", date: "2026-01-10T00:00:00.000Z" }),
    ]

    const result = computeDerivedExpenseData(
      activeExpenses,
      "INR",
      null,
      "2026-03",
      false
    )

    expect(result.effectiveSelectedMonth).toBeNull()
  })

  it("resolves effectiveSelectedMonth to null when no month is selected", () => {
    const activeExpenses = [
      makeExpense({ id: "1", currency: "INR", date: "2026-01-10T00:00:00.000Z" }),
    ]

    const result = computeDerivedExpenseData(activeExpenses, "INR", null, null, false)

    expect(result.effectiveSelectedMonth).toBeNull()
  })

  it("passes through the loading flag", () => {
    const result = computeDerivedExpenseData([], "INR", null, null, true)
    expect(result.isLoading).toBe(true)
  })
})
