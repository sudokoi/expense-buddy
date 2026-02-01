import { formatISO, subDays } from "date-fns"
import {
  getAvailableMonths,
  getDateRangeForMonth,
  getMonthStartDate,
  isTimeWindowCovered,
} from "./time"
import type { Expense } from "../../types/expense"

const createExpense = (daysAgo: number): Expense => {
  const date = formatISO(subDays(new Date(), daysAgo))
  return {
    id: `expense-${daysAgo}`,
    amount: 10,
    category: "Food",
    date,
    note: "",
    currency: "INR",
    createdAt: date,
    updatedAt: date,
  }
}

describe("isTimeWindowCovered", () => {
  it("returns false for all time window", () => {
    const expenses = [createExpense(2)]
    expect(isTimeWindowCovered(expenses, "all")).toBe(false)
  })

  it("returns false when there are no expenses", () => {
    expect(isTimeWindowCovered([], "7d")).toBe(false)
  })

  it("returns true when oldest expense covers the window", () => {
    const expenses = [createExpense(0), createExpense(6)]
    expect(isTimeWindowCovered(expenses, "7d")).toBe(true)
  })

  it("returns false when oldest expense does not cover the window", () => {
    const expenses = [createExpense(0), createExpense(5)]
    expect(isTimeWindowCovered(expenses, "7d")).toBe(false)
  })
})

describe("getAvailableMonths", () => {
  it("returns sorted unique months", () => {
    const expenses: Expense[] = [
      {
        id: "exp-1",
        amount: 10,
        category: "Food",
        date: "2025-12-01T10:00:00Z",
        note: "",
        currency: "INR",
        createdAt: "2025-12-01T10:00:00Z",
        updatedAt: "2025-12-01T10:00:00Z",
      },
      {
        id: "exp-2",
        amount: 20,
        category: "Food",
        date: "2025-11-15T10:00:00Z",
        note: "",
        currency: "INR",
        createdAt: "2025-11-15T10:00:00Z",
        updatedAt: "2025-11-15T10:00:00Z",
      },
      {
        id: "exp-3",
        amount: 30,
        category: "Food",
        date: "2025-12-20T10:00:00Z",
        note: "",
        currency: "INR",
        createdAt: "2025-12-20T10:00:00Z",
        updatedAt: "2025-12-20T10:00:00Z",
      },
    ]

    expect(getAvailableMonths(expenses)).toEqual(["2025-12", "2025-11"])
  })
})

describe("getMonthStartDate", () => {
  it("parses valid month keys", () => {
    const date = getMonthStartDate("2024-02")
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(1)
  })

  it("rejects invalid month keys", () => {
    const invalidKeys = ["2024-13", "2024-00", "2024-1", "abcd-ef"]
    for (const key of invalidKeys) {
      const date = getMonthStartDate(key)
      expect(date.getFullYear()).toBe(1970)
      expect(date.getMonth()).toBe(0)
    }
  })
})

describe("getDateRangeForMonth", () => {
  it("returns month range for valid key", () => {
    const range = getDateRangeForMonth("2024-02")
    expect(range.start.getFullYear()).toBe(2024)
    expect(range.start.getMonth()).toBe(1)
    expect(range.start.getDate()).toBe(1)
    expect(range.end.getMonth()).toBe(1)
  })
})
