import { formatISO, subDays } from "date-fns"
import { isTimeWindowCovered } from "./time"
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
