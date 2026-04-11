jest.mock("../../services/expense-storage", () => ({
  loadAllExpensesFromStorage: jest.fn(),
  migrateLegacyExpensesToV1: jest.fn(),
  persistExpenseAdded: jest.fn(),
  persistExpensesAdded: jest.fn(() => Promise.resolve()),
  persistExpenseUpdated: jest.fn(),
  persistExpensesSnapshot: jest.fn(),
  persistExpensesUpdated: jest.fn(),
  removeLegacyExpensesKey: jest.fn(),
}))

jest.mock("../../services/expense-dirty-days", () => ({
  loadDirtyDays: jest.fn(),
  markDirtyDay: jest.fn(() => Promise.resolve()),
  markDeletedDay: jest.fn(),
  clearDirtyDays: jest.fn(),
}))

jest.mock("../../services/sync-queue", () => ({
  enqueueSyncOp: jest.fn(() => Promise.resolve()),
}))

jest.mock("../helpers", () => ({
  performAutoSyncOnChange: jest.fn(() => Promise.resolve()),
  performAutoSyncOnLaunch: jest.fn(() => Promise.resolve()),
}))

import { expenseStore } from "../expense-store"
import type { Expense } from "../../types/expense"
import { persistExpensesAdded } from "../../services/expense-storage"
import { markDirtyDay } from "../../services/expense-dirty-days"
import { enqueueSyncOp } from "../../services/sync-queue"
import { performAutoSyncOnChange } from "../helpers"

const mockPersistExpensesAdded = persistExpensesAdded as jest.MockedFunction<
  typeof persistExpensesAdded
>
const mockMarkDirtyDay = markDirtyDay as jest.MockedFunction<typeof markDirtyDay>
const mockEnqueueSyncOp = enqueueSyncOp as jest.MockedFunction<typeof enqueueSyncOp>
const mockPerformAutoSyncOnChange = performAutoSyncOnChange as jest.MockedFunction<
  typeof performAutoSyncOnChange
>

function createExpense(id: string, date: string, note: string): Expense {
  return {
    id,
    amount: 100,
    currency: "INR",
    category: " Food ",
    date,
    note,
    paymentMethod: {
      type: "Debit Card",
      identifier: " 4321 ",
      instrumentId: " inst-1 ",
    },
    createdAt: "2026-04-11T10:00:00.000Z",
    updatedAt: "2026-04-11T10:00:00.000Z",
  }
}

function flushEffects(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("expenseStore addExpenses", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    expenseStore.trigger.loadExpenses({
      expenses: [],
      dirtyDays: [],
      deletedDays: [],
    })
  })

  it("adds batched expenses in order, marks dirty days, persists, and enqueues one batch sync op", async () => {
    const first = createExpense("1", "2026-04-10", " first ")
    const second = createExpense("2", "2026-04-11", " second ")

    expenseStore.trigger.addExpenses({ expenses: [first, second] })

    const context = expenseStore.getSnapshot().context
    expect(context.expenses.map((expense) => expense.id)).toEqual(["1", "2"])
    expect(context.expenses[0].note).toBe("first")
    expect(context.expenses[0].category).toBe("Food")
    expect(context.expenses[0].paymentMethod).toEqual({
      type: "Debit Card",
      identifier: "4321",
      instrumentId: "inst-1",
    })
    expect(context.dirtyDays).toEqual(["2026-04-10", "2026-04-11"])

    await flushEffects()

    expect(mockPersistExpensesAdded).toHaveBeenCalledTimes(1)
    expect(mockPersistExpensesAdded).toHaveBeenCalledWith([
      expect.objectContaining({ id: "1", note: "first", category: "Food" }),
      expect.objectContaining({ id: "2", note: "second", category: "Food" }),
    ])
    expect(mockMarkDirtyDay).toHaveBeenCalledTimes(2)
    expect(mockMarkDirtyDay).toHaveBeenNthCalledWith(1, "2026-04-10")
    expect(mockMarkDirtyDay).toHaveBeenNthCalledWith(2, "2026-04-11")
    expect(mockEnqueueSyncOp).toHaveBeenCalledTimes(1)
    expect(mockEnqueueSyncOp).toHaveBeenCalledWith({
      type: "expense.batchUpsert",
      expenses: [
        expect.objectContaining({ id: "1", note: "first", category: "Food" }),
        expect.objectContaining({ id: "2", note: "second", category: "Food" }),
      ],
    })
    expect(mockPerformAutoSyncOnChange).toHaveBeenCalledTimes(1)
    expect(mockPerformAutoSyncOnChange).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "1" }), expect.objectContaining({ id: "2" })],
      expect.any(Object)
    )
  })

  it("deduplicates dirty day writes for multiple expenses on the same day", async () => {
    expenseStore.trigger.addExpenses({
      expenses: [
        createExpense("1", "2026-04-10", "first"),
        createExpense("2", "2026-04-10", "second"),
      ],
    })

    await flushEffects()

    expect(mockMarkDirtyDay).toHaveBeenCalledTimes(1)
    expect(mockMarkDirtyDay).toHaveBeenCalledWith("2026-04-10")
  })
})
