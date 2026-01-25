import { Expense } from "../../types/expense"
import {
  groupExpensesByCurrency,
  filterExpensesByTimeWindow,
} from "../analytics-calculations"
import { getFallbackCurrency } from "../currency"

describe("Analytics Reproduction", () => {
  it("should show USD data when only 1 USD expense exists and settings is USD", () => {
    const now = new Date().toISOString()
    const expenses: Expense[] = [
      {
        id: "1",
        amount: 100,
        category: "Food",
        date: now,
        note: "Test",
        currency: "USD",
        createdAt: now,
        updatedAt: now,
      },
    ]

    const settingsDefaultCurrency = "USD"

    // 1. Group ALL active expenses (Refactored Step 1)
    const grouped = groupExpensesByCurrency(expenses, getFallbackCurrency())
    expect(grouped.has("USD")).toBe(true)

    const available = Array.from(grouped.keys()).sort()
    expect(available).toEqual(["USD"])

    // 2. Determine Effective Currency
    let effective = "INR" // Fail default
    const expensesByCurrency = grouped
    const selectedCurrency = null

    if (selectedCurrency && expensesByCurrency.has(selectedCurrency)) {
      effective = selectedCurrency
    } else if (available.length === 1) {
      effective = available[0]
    } else if (expensesByCurrency.has(settingsDefaultCurrency)) {
      effective = settingsDefaultCurrency
    } else {
      effective = available[0] || settingsDefaultCurrency
    }

    expect(effective).toBe("USD")

    // 3. Get expenses for the effective currency (ALL TIME)
    const currencyExpenses = expensesByCurrency.get(effective) || []
    expect(currencyExpenses.length).toBe(1)

    // 4. Filter by Time Window (Refactored Step 4)
    const timeFiltered = filterExpensesByTimeWindow(currencyExpenses, "7d")
    expect(timeFiltered.length).toBe(1)
  })

  it("should show USD data when legacy INR exists (old) and 1 USD expense (new)", () => {
    const now = new Date().toISOString()
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 30) // 30 days ago

    const expenses: Expense[] = [
      {
        id: "1",
        amount: 100,
        category: "Food",
        date: now, // Today
        note: "Test USD",
        currency: "USD",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "2",
        amount: 500,
        category: "Food",
        date: oldDate.toISOString(), // Old
        note: "Test INR",
        // currency: undefined -> Legacy INR
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
      },
    ]

    const settingsDefaultCurrency = "USD"

    // 1. Group ALL active expenses (Refactored Step 1)
    // This is key: we want to know INR exists even if it's old
    const grouped = groupExpensesByCurrency(expenses, getFallbackCurrency())
    expect(grouped.has("USD")).toBe(true)
    expect(grouped.has("INR")).toBe(true)

    const available = Array.from(grouped.keys()).sort()
    expect(available).toEqual(["INR", "USD"])

    // 2. Determine Effective Currency
    let effective = "INR"
    const expensesByCurrency = grouped
    const selectedCurrency = null // Simulate no user selection

    // Logic check:
    // - selectedCurrency is null
    // - available > 1
    // - settingsDefaultCurrency (USD) is in expensesByCurrency? YES.

    if (selectedCurrency && expensesByCurrency.has(selectedCurrency)) {
      effective = selectedCurrency
    } else if (available.length === 1) {
      effective = available[0]
    } else if (expensesByCurrency.has(settingsDefaultCurrency)) {
      effective = settingsDefaultCurrency
    } else {
      effective = available[0] || settingsDefaultCurrency
    }

    expect(effective).toBe("USD")

    // 3. Get expenses for the effective currency (ALL TIME)
    const currencyExpenses = expensesByCurrency.get(effective) || []
    expect(currencyExpenses.length).toBe(1)
    expect(currencyExpenses[0].currency).toBe("USD")

    // 4. Filter by Time Window (7d)
    // Should keep the USD expense as it is "today"
    const timeFiltered = filterExpensesByTimeWindow(currencyExpenses, "7d")
    expect(timeFiltered.length).toBe(1)
    expect(timeFiltered[0].currency).toBe("USD")
  })
})
