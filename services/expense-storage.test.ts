import { getItem, setItem, clear as clearStorage } from "./storage"
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
    await clearStorage()
  })

  it("writes the index and items correctly", async () => {
    const expenses = [createExpense("expense-1"), createExpense("expense-2")]

    await persistExpensesAdded(expenses)

    const loaded = await loadAllExpensesFromStorage()
    expect(loaded.expenses).toHaveLength(2)
    expect(loaded.expenses.map((e) => e.id).sort()).toEqual(["expense-1", "expense-2"])
  })

  it("heals the index when a batched write only persists a subset of items", async () => {
    const expenses = [createExpense("expense-1"), createExpense("expense-2")]

    await setItem("expenses:item:v1:expense-1", JSON.stringify(expenses[0]))
    await setItem("expenses:index:v1", JSON.stringify(["expense-1", "expense-2"]))

    const loaded = await loadAllExpensesFromStorage()
    expect(loaded.expenses.map((expense) => expense.id)).toEqual(["expense-1"])

    const index = await getItem("expenses:index:v1")
    expect(JSON.parse(index!)).toEqual(["expense-1"])
  })
})
