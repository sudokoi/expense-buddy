import { getItem, clear } from "./storage"
import { loadAllExpensesFromStorage, persistExpensesAdded } from "./expense-storage"
import type { Expense } from "../types/expense"

function createExpense(id: string): Expense {
  return {
    id,
    amount: 100,
    currency: "INR",
    category: "Food",
    date: "2026-04-11",
    note: `Expense ${id}`,
    createdAt: "2026-04-11T10:00:00.000Z",
    updatedAt: "2026-04-11T10:00:00.000Z",
  }
}

describe("expense-storage", () => {
  beforeEach(async () => {
    await clear()
  })

  it("persists expenses and allows roundtrip load", async () => {
    const expenses = [createExpense("expense-1"), createExpense("expense-2")]

    await persistExpensesAdded(expenses)

    const indexRaw = await getItem("expenses:index:v1")
    expect(JSON.parse(indexRaw!)).toEqual(["expense-1", "expense-2"])

    const loaded = await loadAllExpensesFromStorage()
    expect(loaded.expenses).toHaveLength(2)
    expect(loaded.expenses.map((e) => e.id)).toEqual(["expense-1", "expense-2"])
  })

  it("heals the index when items are missing", async () => {
    const expense1 = createExpense("expense-1")

    await clear()
    await persistExpensesAdded([expense1])

    const indexRaw = await getItem("expenses:index:v1")
    expect(JSON.parse(indexRaw!)).toEqual(["expense-1"])

    const loaded = await loadAllExpensesFromStorage()
    expect(loaded.expenses).toHaveLength(1)
    expect(loaded.expenses[0].id).toBe("expense-1")
  })
})
