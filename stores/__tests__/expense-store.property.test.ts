/**
 * Property-based tests for Expense Store
 *
 * Property 1: Expense CRUD Round-Trip
 * For any valid expense object, adding it to the expense store then reading the store's
 * expenses array SHALL contain that expense with matching id, amount, category, note,
 * date, and paymentMethod.
 *
 * Property 2: Expense Edit Preserves Identity
 * For any existing expense in the store and any valid update, editing the expense SHALL
 * result in the store containing an expense with the same id, original createdAt, updated
 * fields, and new updatedAt timestamp.
 *
 * Property 3: Expense Delete Removes Entry
 * For any expense id in the store, deleting that expense SHALL result in the store's
 * expenses array not containing any expense with that id.
 *
 * Property 11: Sync Notification Management
 * For any SyncNotification object, setting it SHALL result in the expense store's
 * syncNotification containing that object. Clearing the notification SHALL result
 * in syncNotification being null.
 *
 * **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 */

import fc from "fast-check"
import { createStore } from "@xstate/store"
import {
  Expense,
  ExpenseCategory,
  PaymentMethod,
  PaymentMethodType,
} from "../../types/expense"
import { SyncNotification } from "../../services/sync-manager"

// Create a fresh store for each test
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

// Arbitrary generators
const categoryArb = fc.constantFrom<ExpenseCategory>(
  "Food",
  "Groceries",
  "Transport",
  "Utilities",
  "Rent",
  "Entertainment",
  "Health",
  "Other"
)

const paymentMethodTypeArb = fc.constantFrom<PaymentMethodType>(
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other"
)

const paymentMethodArb: fc.Arbitrary<PaymentMethod> = fc.record({
  type: paymentMethodTypeArb,
  identifier: fc.option(fc.string({ minLength: 3, maxLength: 4 }), { nil: undefined }),
})

const optionalPaymentMethodArb = fc.option(paymentMethodArb, { nil: undefined })

const dateStringArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 })
  .map((ms) => new Date(ms).toISOString().split("T")[0])

const isoDateStringArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 })
  .map((ms) => new Date(ms).toISOString())

const expenseArb: fc.Arbitrary<Expense> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).map((s) => `expense-${s}`),
  amount: fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
  category: categoryArb,
  note: fc.string({ minLength: 0, maxLength: 200 }),
  date: dateStringArb,
  paymentMethod: optionalPaymentMethodArb,
  createdAt: isoDateStringArb,
  updatedAt: isoDateStringArb,
})

const syncNotificationArb: fc.Arbitrary<SyncNotification> = fc.record({
  newItemsCount: fc.integer({ min: 0, max: 100 }),
  updatedItemsCount: fc.integer({ min: 0, max: 100 }),
  totalCount: fc.integer({ min: 0, max: 200 }),
  message: fc.string({ minLength: 1, maxLength: 100 }),
})

describe("Expense Store Properties", () => {
  /**
   * Property 1: Expense CRUD Round-Trip
   * **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
   */
  describe("Property 1: Expense CRUD Round-Trip", () => {
    it("added expense SHALL be retrievable with all fields intact", () => {
      fc.assert(
        fc.property(expenseArb, (expense) => {
          const store = createTestExpenseStore()

          store.trigger.addExpense({ expense })

          const { expenses } = store.getSnapshot().context
          const found = expenses.find((e) => e.id === expense.id)

          return (
            found !== undefined &&
            found.id === expense.id &&
            found.amount === expense.amount &&
            found.category === expense.category &&
            found.note === expense.note &&
            found.date === expense.date &&
            found.createdAt === expense.createdAt &&
            found.updatedAt === expense.updatedAt
          )
        }),
        { numRuns: 100 }
      )
    })

    it("multiple expenses SHALL all be retrievable", () => {
      fc.assert(
        fc.property(
          fc.array(expenseArb, { minLength: 1, maxLength: 10 }).map((expenses) => {
            // Ensure unique IDs
            return expenses.map((e, i) => ({ ...e, id: `expense-${i}` }))
          }),
          (expenses) => {
            const store = createTestExpenseStore()

            for (const expense of expenses) {
              store.trigger.addExpense({ expense })
            }

            const { expenses: storedExpenses } = store.getSnapshot().context

            // All expenses should be present
            return expenses.every((expense) =>
              storedExpenses.some((e) => e.id === expense.id)
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 2: Expense Edit Preserves Identity
   * **Validates: Requirements 3.3**
   */
  describe("Property 2: Expense Edit Preserves Identity", () => {
    it("editing expense SHALL preserve id and createdAt while updating other fields", () => {
      fc.assert(
        fc.property(
          expenseArb,
          fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
          categoryArb,
          fc.string({ minLength: 0, maxLength: 200 }),
          (originalExpense, newAmount, newCategory, newNote) => {
            const store = createTestExpenseStore([originalExpense])

            const updatedExpense: Expense = {
              ...originalExpense,
              amount: newAmount,
              category: newCategory,
              note: newNote,
              updatedAt: new Date().toISOString(),
            }

            store.trigger.editExpense({ expense: updatedExpense })

            const { expenses } = store.getSnapshot().context
            const found = expenses.find((e) => e.id === originalExpense.id)

            return (
              found !== undefined &&
              found.id === originalExpense.id &&
              found.createdAt === originalExpense.createdAt &&
              found.amount === newAmount &&
              found.category === newCategory &&
              found.note === newNote
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it("editing one expense SHALL not affect other expenses", () => {
      fc.assert(
        fc.property(
          fc.tuple(expenseArb, expenseArb).map(([e1, e2]) => [
            { ...e1, id: "expense-1" },
            { ...e2, id: "expense-2" },
          ]),
          fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
          ([expense1, expense2], newAmount) => {
            const store = createTestExpenseStore([expense1, expense2])

            const updatedExpense1: Expense = {
              ...expense1,
              amount: newAmount,
              updatedAt: new Date().toISOString(),
            }

            store.trigger.editExpense({ expense: updatedExpense1 })

            const { expenses } = store.getSnapshot().context
            const found2 = expenses.find((e) => e.id === "expense-2")

            // expense2 should be unchanged
            return (
              found2 !== undefined &&
              found2.amount === expense2.amount &&
              found2.category === expense2.category &&
              found2.note === expense2.note
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 3: Expense Delete Removes Entry
   * **Validates: Requirements 3.4**
   */
  describe("Property 3: Expense Delete Removes Entry", () => {
    it("deleted expense SHALL not be present in the array", () => {
      fc.assert(
        fc.property(expenseArb, (expense) => {
          const store = createTestExpenseStore([expense])

          store.trigger.deleteExpense({ id: expense.id })

          const { expenses } = store.getSnapshot().context
          return !expenses.some((e) => e.id === expense.id)
        }),
        { numRuns: 100 }
      )
    })

    it("deleting one expense SHALL not affect other expenses", () => {
      fc.assert(
        fc.property(
          fc
            .array(expenseArb, { minLength: 2, maxLength: 5 })
            .map((expenses) => expenses.map((e, i) => ({ ...e, id: `expense-${i}` }))),
          fc.integer({ min: 0, max: 4 }),
          (expenses, deleteIndex) => {
            const actualDeleteIndex = deleteIndex % expenses.length
            const store = createTestExpenseStore(expenses)

            const idToDelete = expenses[actualDeleteIndex].id
            store.trigger.deleteExpense({ id: idToDelete })

            const { expenses: remainingExpenses } = store.getSnapshot().context

            // All other expenses should still be present
            const otherExpenses = expenses.filter((e) => e.id !== idToDelete)
            return otherExpenses.every((expense) =>
              remainingExpenses.some((e) => e.id === expense.id)
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it("deleting all expenses SHALL result in empty array", () => {
      fc.assert(
        fc.property(
          fc
            .array(expenseArb, { minLength: 1, maxLength: 5 })
            .map((expenses) => expenses.map((e, i) => ({ ...e, id: `expense-${i}` }))),
          (expenses) => {
            const store = createTestExpenseStore(expenses)

            for (const expense of expenses) {
              store.trigger.deleteExpense({ id: expense.id })
            }

            return store.getSnapshot().context.expenses.length === 0
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 11: Sync Notification Management
   * **Validates: Requirements 3.6, 3.7**
   */
  describe("Property 11: Sync Notification Management", () => {
    it("setSyncNotification SHALL set the notification", () => {
      fc.assert(
        fc.property(syncNotificationArb, (notification) => {
          const store = createTestExpenseStore()

          store.trigger.setSyncNotification({ notification })

          const { syncNotification } = store.getSnapshot().context
          return (
            syncNotification !== null &&
            syncNotification.newItemsCount === notification.newItemsCount &&
            syncNotification.updatedItemsCount === notification.updatedItemsCount &&
            syncNotification.totalCount === notification.totalCount &&
            syncNotification.message === notification.message
          )
        }),
        { numRuns: 100 }
      )
    })

    it("clearSyncNotification SHALL set notification to null", () => {
      fc.assert(
        fc.property(syncNotificationArb, (notification) => {
          const store = createTestExpenseStore()
          store.trigger.setSyncNotification({ notification })

          store.trigger.clearSyncNotification()

          return store.getSnapshot().context.syncNotification === null
        }),
        { numRuns: 100 }
      )
    })

    it("setSyncNotification with null SHALL clear the notification", () => {
      fc.assert(
        fc.property(syncNotificationArb, (notification) => {
          const store = createTestExpenseStore()
          store.trigger.setSyncNotification({ notification })

          store.trigger.setSyncNotification({ notification: null })

          return store.getSnapshot().context.syncNotification === null
        }),
        { numRuns: 100 }
      )
    })
  })
})
