import { groupExpensesByDay } from "./daily-file-manager"
import type { Expense } from "../types/expense"

describe("groupExpensesByDay", () => {
  it("groups expenses across midnight into separate days", () => {
    const now = new Date().toISOString()
    const expenses: Expense[] = [
      {
        id: "expense-1",
        amount: 10,
        category: "Food",
        note: "Late snack",
        date: "2026-01-01T23:59:59",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "expense-2",
        amount: 15,
        category: "Food",
        note: "Early snack",
        date: "2026-01-02T00:00:00",
        createdAt: now,
        updatedAt: now,
      },
    ]

    const grouped = groupExpensesByDay(expenses)
    const keys = Array.from(grouped.keys()).sort()

    expect(keys).toEqual(["2026-01-01", "2026-01-02"])
    expect(grouped.get("2026-01-01")).toHaveLength(1)
    expect(grouped.get("2026-01-02")).toHaveLength(1)
  })
})
