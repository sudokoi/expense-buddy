import { useCallback, useMemo } from "react"
import { useSelector } from "@xstate/store-react"
import { useStoreContext } from "../store-provider"
import { Expense } from "../../types/expense"
import { getActiveExpenses } from "../expense-store"

export const useExpenses = () => {
  const { expenseStore } = useStoreContext()

  const expenses = useSelector(expenseStore, (state) => state.context.expenses)
  const isLoading = useSelector(expenseStore, (state) => state.context.isLoading)
  const syncNotification = useSelector(
    expenseStore,
    (state) => state.context.syncNotification
  )
  const dirtyDays = useSelector(expenseStore, (state) => state.context.dirtyDays)
  const deletedDays = useSelector(expenseStore, (state) => state.context.deletedDays)
  const clearDirtyDaysAfterSync = useCallback(
    () => expenseStore.trigger.clearDirtyDaysAfterSync(),
    [expenseStore]
  )

  const activeExpenses = useMemo(() => getActiveExpenses(expenses), [expenses])

  const addExpense = useCallback(
    (expense: Omit<Expense, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString()
      expenseStore.trigger.addExpense({
        expense: {
          ...expense,
          id: Date.now().toString(),
          createdAt: now,
          updatedAt: now,
        },
      })
    },
    [expenseStore]
  )

  const addExpenses = useCallback(
    (expenses: Array<Omit<Expense, "id" | "createdAt" | "updatedAt">>) => {
      const baseTimestamp = Date.now()
      const createdExpenses = expenses.map((expense, index) => {
        const now = new Date(baseTimestamp + index).toISOString()
        return {
          ...expense,
          id: `${baseTimestamp}_${index}`,
          createdAt: now,
          updatedAt: now,
        }
      })

      expenseStore.trigger.addExpenses({ expenses: createdExpenses })
      return createdExpenses
    },
    [expenseStore]
  )

  const editExpense = useCallback(
    (id: string, updates: Omit<Expense, "id" | "createdAt" | "updatedAt">) => {
      const existing = expenseStore
        .getSnapshot()
        .context.expenses.find((e) => e.id === id)
      if (!existing) return

      expenseStore.trigger.editExpense({
        expense: {
          ...existing,
          ...updates,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        },
      })
    },
    [expenseStore]
  )

  const deleteExpense = useCallback(
    (id: string) => expenseStore.trigger.deleteExpense({ id }),
    [expenseStore]
  )

  const replaceAllExpenses = useCallback(
    (newExpenses: Expense[]) =>
      expenseStore.trigger.replaceExpenses({ expenses: newExpenses }),
    [expenseStore]
  )

  const clearSyncNotification = useCallback(
    () => expenseStore.trigger.clearSyncNotification(),
    [expenseStore]
  )

  const reassignExpensesToOther = useCallback(
    (fromCategory: string) =>
      expenseStore.trigger.reassignExpensesToOther({ fromCategory }),
    [expenseStore]
  )

  const updateExpenseCategories = useCallback(
    (fromCategory: string, toCategory: string) =>
      expenseStore.trigger.updateExpenseCategories({ fromCategory, toCategory }),
    [expenseStore]
  )

  return {
    state: {
      expenses,
      activeExpenses,
      isLoading,
      syncNotification,
      dirtyDays,
      deletedDays,
    },
    addExpense,
    addExpenses,
    editExpense,
    deleteExpense,
    replaceAllExpenses,
    clearSyncNotification,
    clearDirtyDaysAfterSync,
    reassignExpensesToOther,
    updateExpenseCategories,
  }
}
