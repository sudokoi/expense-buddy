/**
 * Unit tests for Expense Store
 */

import { createStore } from "@xstate/store"
import { Expense, ExpenseCategory, PaymentMethod } from "../../types/expense"
import { SyncNotification } from "../../services/sync-manager"
import { getLocalDayKey } from "../../utils/date"

// Create a fresh store for each test to avoid state pollution
function createTestExpenseStore(initialExpenses: Expense[] = []) {
  return createStore({
    context: {
      expenses: initialExpenses,
      isLoading: false,
      syncNotification: null as SyncNotification | null,
    },

    on: {
      loadExpenses: (context, event: { expenses: Expense[] }) => ({
        ...context,
        expenses: event.expenses,
        isLoading: false,
      }),

      setLoading: (context, event: { isLoading: boolean }) => ({
        ...context,
        isLoading: event.isLoading,
      }),

      addExpense: (context, event: { expense: Expense }) => {
        const newExpenses = [event.expense, ...context.expenses]
        return { ...context, expenses: newExpenses }
      },

      editExpense: (context, event: { expense: Expense }) => {
        const newExpenses = context.expenses.map((e) =>
          e.id === event.expense.id ? event.expense : e
        )
        return { ...context, expenses: newExpenses }
      },

      deleteExpense: (context, event: { id: string }) => {
        const newExpenses = context.expenses.filter((e) => e.id !== event.id)
        return { ...context, expenses: newExpenses }
      },

      replaceExpenses: (context, event: { expenses: Expense[] }) => ({
        ...context,
        expenses: event.expenses,
      }),

      setSyncNotification: (
        context,
        event: { notification: SyncNotification | null }
      ) => ({
        ...context,
        syncNotification: event.notification,
      }),

      clearSyncNotification: (context) => ({
        ...context,
        syncNotification: null,
      }),
    },
  })
}

// Helper to create a test expense
function createTestExpense(overrides: Partial<Expense> = {}): Expense {
  const now = new Date().toISOString()
  return {
    id: Date.now().toString() + Math.random().toString(36),
    amount: 100,
    category: "Food" as ExpenseCategory,
    note: "Test expense",
    date: getLocalDayKey(now),
    paymentMethod: { type: "Cash" } as PaymentMethod,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe("Expense Store", () => {
  describe("Initial state", () => {
    it("should start with empty expenses array", () => {
      const store = createTestExpenseStore()
      expect(store.getSnapshot().context.expenses).toEqual([])
    })

    it("should start with isLoading=false", () => {
      const store = createTestExpenseStore()
      expect(store.getSnapshot().context.isLoading).toBe(false)
    })

    it("should start with syncNotification=null", () => {
      const store = createTestExpenseStore()
      expect(store.getSnapshot().context.syncNotification).toBeNull()
    })
  })

  describe("loadExpenses action", () => {
    it("should load expenses and set isLoading to false", () => {
      const store = createTestExpenseStore()
      const expenses = [createTestExpense(), createTestExpense()]

      store.trigger.loadExpenses({ expenses })

      const { expenses: loadedExpenses, isLoading } = store.getSnapshot().context
      expect(loadedExpenses).toHaveLength(2)
      expect(isLoading).toBe(false)
    })
  })

  describe("setLoading action", () => {
    it("should update isLoading state", () => {
      const store = createTestExpenseStore()

      store.trigger.setLoading({ isLoading: true })
      expect(store.getSnapshot().context.isLoading).toBe(true)

      store.trigger.setLoading({ isLoading: false })
      expect(store.getSnapshot().context.isLoading).toBe(false)
    })
  })

  describe("addExpense action", () => {
    it("should add expense to the beginning of the array", () => {
      const store = createTestExpenseStore()
      const expense1 = createTestExpense({ note: "First" })
      const expense2 = createTestExpense({ note: "Second" })

      store.trigger.addExpense({ expense: expense1 })
      store.trigger.addExpense({ expense: expense2 })

      const { expenses } = store.getSnapshot().context
      expect(expenses).toHaveLength(2)
      expect(expenses[0].note).toBe("Second")
      expect(expenses[1].note).toBe("First")
    })

    it("should preserve all expense fields", () => {
      const store = createTestExpenseStore()
      const expense = createTestExpense({
        amount: 250.5,
        category: "Transport" as ExpenseCategory,
        note: "Uber ride",
        paymentMethod: { type: "UPI" } as PaymentMethod,
      })

      store.trigger.addExpense({ expense })

      const { expenses } = store.getSnapshot().context
      expect(expenses[0]).toEqual(expense)
    })
  })

  describe("editExpense action", () => {
    it("should update existing expense by id", () => {
      const expense = createTestExpense({ note: "Original" })
      const store = createTestExpenseStore([expense])

      const updatedExpense = { ...expense, note: "Updated", amount: 200 }
      store.trigger.editExpense({ expense: updatedExpense })

      const { expenses } = store.getSnapshot().context
      expect(expenses[0].note).toBe("Updated")
      expect(expenses[0].amount).toBe(200)
      expect(expenses[0].id).toBe(expense.id)
    })

    it("should not modify other expenses", () => {
      const expense1 = createTestExpense({ id: "1", note: "First" })
      const expense2 = createTestExpense({ id: "2", note: "Second" })
      const store = createTestExpenseStore([expense1, expense2])

      const updatedExpense1 = { ...expense1, note: "Updated First" }
      store.trigger.editExpense({ expense: updatedExpense1 })

      const { expenses } = store.getSnapshot().context
      expect(expenses.find((e) => e.id === "1")?.note).toBe("Updated First")
      expect(expenses.find((e) => e.id === "2")?.note).toBe("Second")
    })

    it("should do nothing if expense id not found", () => {
      const expense = createTestExpense({ id: "1" })
      const store = createTestExpenseStore([expense])

      const nonExistentExpense = createTestExpense({ id: "999", note: "Ghost" })
      store.trigger.editExpense({ expense: nonExistentExpense })

      const { expenses } = store.getSnapshot().context
      expect(expenses).toHaveLength(1)
      expect(expenses[0].id).toBe("1")
    })
  })

  describe("deleteExpense action", () => {
    it("should remove expense by id", () => {
      const expense1 = createTestExpense({ id: "1" })
      const expense2 = createTestExpense({ id: "2" })
      const store = createTestExpenseStore([expense1, expense2])

      store.trigger.deleteExpense({ id: "1" })

      const { expenses } = store.getSnapshot().context
      expect(expenses).toHaveLength(1)
      expect(expenses[0].id).toBe("2")
    })

    it("should do nothing if expense id not found", () => {
      const expense = createTestExpense({ id: "1" })
      const store = createTestExpenseStore([expense])

      store.trigger.deleteExpense({ id: "999" })

      const { expenses } = store.getSnapshot().context
      expect(expenses).toHaveLength(1)
    })

    it("should handle deleting from empty array", () => {
      const store = createTestExpenseStore()

      store.trigger.deleteExpense({ id: "any" })

      expect(store.getSnapshot().context.expenses).toEqual([])
    })
  })

  describe("replaceExpenses action", () => {
    it("should replace all expenses", () => {
      const oldExpenses = [createTestExpense({ id: "old1" })]
      const store = createTestExpenseStore(oldExpenses)

      const newExpenses = [
        createTestExpense({ id: "new1" }),
        createTestExpense({ id: "new2" }),
      ]
      store.trigger.replaceExpenses({ expenses: newExpenses })

      const { expenses } = store.getSnapshot().context
      expect(expenses).toHaveLength(2)
      expect(expenses.map((e) => e.id)).toEqual(["new1", "new2"])
    })

    it("should allow replacing with empty array", () => {
      const store = createTestExpenseStore([createTestExpense()])

      store.trigger.replaceExpenses({ expenses: [] })

      expect(store.getSnapshot().context.expenses).toEqual([])
    })
  })

  describe("setSyncNotification action", () => {
    it("should set sync notification", () => {
      const store = createTestExpenseStore()
      const notification: SyncNotification = {
        newItemsCount: 5,
        updatedItemsCount: 2,
        totalCount: 7,
        message: "Synced 7 items",
      }

      store.trigger.setSyncNotification({ notification })

      expect(store.getSnapshot().context.syncNotification).toEqual(notification)
    })

    it("should allow setting notification to null", () => {
      const store = createTestExpenseStore()
      store.trigger.setSyncNotification({
        notification: {
          newItemsCount: 1,
          updatedItemsCount: 0,
          totalCount: 1,
          message: "Synced 1 item",
        },
      })

      store.trigger.setSyncNotification({ notification: null })

      expect(store.getSnapshot().context.syncNotification).toBeNull()
    })
  })

  describe("clearSyncNotification action", () => {
    it("should clear sync notification", () => {
      const store = createTestExpenseStore()
      store.trigger.setSyncNotification({
        notification: {
          newItemsCount: 1,
          updatedItemsCount: 0,
          totalCount: 1,
          message: "Synced 1 item",
        },
      })

      store.trigger.clearSyncNotification()

      expect(store.getSnapshot().context.syncNotification).toBeNull()
    })
  })
})
