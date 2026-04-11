import AsyncStorage from "@react-native-async-storage/async-storage"
import { loadAllExpensesFromStorage, persistExpensesAdded } from "./expense-storage"
import type { Expense } from "../types/expense"

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>
const storage = new Map<string, string>()

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
  beforeEach(() => {
    storage.clear()
    jest.clearAllMocks()

    mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
      return storage.get(key) ?? null
    })
    mockAsyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
      storage.set(key, value)
    })
    mockAsyncStorage.multiSet.mockImplementation(
      async (entries: readonly (readonly [string, string])[]) => {
        for (const [key, value] of entries) {
          storage.set(key, value)
        }
      }
    )
    mockAsyncStorage.removeItem.mockImplementation(async (key: string) => {
      storage.delete(key)
    })
  })

  it("writes the index before the batch payload and uses multiSet for batched expense inserts", async () => {
    const expenses = [createExpense("expense-1"), createExpense("expense-2")]

    await persistExpensesAdded(expenses)

    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      "expenses:index:v1",
      JSON.stringify(["expense-1", "expense-2"])
    )
    expect(mockAsyncStorage.multiSet).toHaveBeenCalledWith([
      ["expenses:item:v1:expense-1", JSON.stringify(expenses[0])],
      ["expenses:item:v1:expense-2", JSON.stringify(expenses[1])],
    ])
    expect(mockAsyncStorage.setItem.mock.invocationCallOrder[0]).toBeLessThan(
      mockAsyncStorage.multiSet.mock.invocationCallOrder[0]
    )
  })

  it("heals the index when a batched write only persists a subset of items", async () => {
    const expenses = [createExpense("expense-1"), createExpense("expense-2")]

    mockAsyncStorage.multiSet.mockImplementationOnce(
      async (entries: readonly (readonly [string, string])[]) => {
        const [firstEntry] = entries
        if (firstEntry) {
          storage.set(firstEntry[0], firstEntry[1])
        }
        throw new Error("simulated partial write")
      }
    )

    await expect(persistExpensesAdded(expenses)).rejects.toThrow(
      "simulated partial write"
    )

    const loaded = await loadAllExpensesFromStorage()
    expect(loaded.expenses.map((expense) => expense.id)).toEqual(["expense-1"])
    expect(storage.get("expenses:index:v1")).toBe(JSON.stringify(["expense-1"]))
  })
})
