import { createStore } from "@xstate/store"
import { Expense } from "../types/expense"
import { SyncNotification } from "../services/sync-manager"
import {
  loadAllExpensesFromStorage,
  migrateLegacyExpensesToV1,
  persistExpenseAdded,
  persistExpenseUpdated,
  persistExpensesSnapshot,
  persistExpensesUpdated,
  removeLegacyExpensesKey,
} from "../services/expense-storage"
import {
  loadDirtyDays,
  markDirtyDay,
  markDeletedDay,
  clearDirtyDays,
} from "../services/expense-dirty-days"
import { getLocalDayKey } from "../utils/date"
import { AppSettings } from "../services/settings-manager"
import {
  performAutoSyncOnChange,
  performAutoSyncOnLaunch,
  AutoSyncCallbacks,
} from "./helpers"

function normalizeExpenseForSave(expense: Expense): Expense {
  const normalizedNote = expense.note.trim()
  const normalizedCategory = expense.category.trim()
  const normalizedPaymentMethod = expense.paymentMethod
    ? {
        ...expense.paymentMethod,
        identifier: expense.paymentMethod.identifier?.trim() || undefined,
        instrumentId: expense.paymentMethod.instrumentId?.trim() || undefined,
      }
    : undefined

  return {
    ...expense,
    note: normalizedNote,
    category: normalizedCategory,
    paymentMethod: normalizedPaymentMethod,
  }
}

function addUniqueDay(days: string[], dayKey: string): string[] {
  if (days.includes(dayKey)) return days
  return [...days, dayKey].sort()
}

function addUniqueDays(days: string[], dayKeys: string[]): string[] {
  if (dayKeys.length === 0) return days
  const next = new Set(days)
  for (const dayKey of dayKeys) {
    next.add(dayKey)
  }
  return Array.from(next).sort()
}

// Store event emitter for cross-store communication
type SettingsDownloadedListener = (settings: AppSettings) => void
const settingsDownloadedListeners: SettingsDownloadedListener[] = []

export function onSettingsDownloaded(listener: SettingsDownloadedListener): () => void {
  settingsDownloadedListeners.push(listener)
  return () => {
    const index = settingsDownloadedListeners.indexOf(listener)
    if (index > -1) {
      settingsDownloadedListeners.splice(index, 1)
    }
  }
}

export function emitSettingsDownloaded(settings: AppSettings): void {
  settingsDownloadedListeners.forEach((listener) => listener(settings))
}

// Sync notification event emitter for cross-store communication
type SyncNotificationListener = (notification: SyncNotification) => void
const syncNotificationListeners: SyncNotificationListener[] = []

export function onSyncNotification(listener: SyncNotificationListener): () => void {
  syncNotificationListeners.push(listener)
  return () => {
    const index = syncNotificationListeners.indexOf(listener)
    if (index > -1) {
      syncNotificationListeners.splice(index, 1)
    }
  }
}

function emitSyncNotification(notification: SyncNotification): void {
  syncNotificationListeners.forEach((listener) => listener(notification))
}

/**
 * Create auto-sync callbacks for expense store actions
 * These callbacks update store state based on sync results
 */
function createAutoSyncCallbacks(): AutoSyncCallbacks {
  return {
    onExpensesReplaced: (expenses: Expense[]) => {
      expenseStore.trigger.replaceExpenses({ expenses })
    },
    onDirtyDaysCleared: () => {
      expenseStore.trigger.clearDirtyDaysState()
    },
    onSyncNotification: (notification: SyncNotification) => {
      expenseStore.trigger.setSyncNotification({ notification })
    },
    onSettingsDownloaded: (settings: AppSettings) => {
      emitSettingsDownloaded(settings)
    },
  }
}

export const expenseStore = createStore({
  context: {
    expenses: [] as Expense[],
    isLoading: true,
    syncNotification: null as SyncNotification | null,
    dirtyDays: [] as string[],
    deletedDays: [] as string[],
  },

  on: {
    loadExpenses: (
      context,
      event: { expenses: Expense[]; dirtyDays?: string[]; deletedDays?: string[] }
    ) => ({
      ...context,
      expenses: event.expenses,
      isLoading: false,
      dirtyDays: event.dirtyDays ?? context.dirtyDays,
      deletedDays: event.deletedDays ?? context.deletedDays,
    }),

    setLoading: (context, event: { isLoading: boolean }) => ({
      ...context,
      isLoading: event.isLoading,
    }),

    addExpense: (context, event: { expense: Expense }, enqueue) => {
      const normalizedExpense = normalizeExpenseForSave(event.expense)
      const newExpenses = [normalizedExpense, ...context.expenses]
      const dayKey = getLocalDayKey(normalizedExpense.date)
      const dirtyDays = addUniqueDay(context.dirtyDays, dayKey)

      enqueue.effect(async () => {
        await persistExpenseAdded(normalizedExpense)
        await markDirtyDay(dayKey)
        await performAutoSyncOnChange(newExpenses, createAutoSyncCallbacks())
      })

      return { ...context, expenses: newExpenses, dirtyDays }
    },

    editExpense: (context, event: { expense: Expense }, enqueue) => {
      const normalizedExpense = normalizeExpenseForSave(event.expense)
      const existingExpense = context.expenses.find(
        (expense) => expense.id === normalizedExpense.id
      )
      const previousDayKey = existingExpense ? getLocalDayKey(existingExpense.date) : null
      const nextDayKey = getLocalDayKey(normalizedExpense.date)
      const hasOtherOldDayExpenses = previousDayKey
        ? context.expenses.some(
            (expense) =>
              expense.id !== normalizedExpense.id &&
              getLocalDayKey(expense.date) === previousDayKey
          )
        : false
      const deletedDayKey =
        previousDayKey && previousDayKey !== nextDayKey && !hasOtherOldDayExpenses
          ? previousDayKey
          : null
      const newExpenses = context.expenses.map((e) =>
        e.id === normalizedExpense.id ? normalizedExpense : e
      )
      let dirtyDays = addUniqueDay(context.dirtyDays, nextDayKey)
      if (previousDayKey && previousDayKey !== nextDayKey) {
        dirtyDays = addUniqueDay(dirtyDays, previousDayKey)
      }
      let deletedDays = context.deletedDays
      if (deletedDayKey) {
        deletedDays = addUniqueDay(deletedDays, deletedDayKey)
      }

      enqueue.effect(async () => {
        await persistExpenseUpdated(normalizedExpense)
        await markDirtyDay(nextDayKey)
        if (previousDayKey && previousDayKey !== nextDayKey) {
          await markDirtyDay(previousDayKey)
        }
        if (deletedDayKey) {
          await markDeletedDay(deletedDayKey)
        }
        await performAutoSyncOnChange(newExpenses, createAutoSyncCallbacks())
      })

      return { ...context, expenses: newExpenses, dirtyDays, deletedDays }
    },

    deleteExpense: (context, event: { id: string }, enqueue) => {
      const now = new Date().toISOString()
      // Soft delete: mark with deletedAt timestamp instead of removing
      let updatedExpense: Expense | null = null
      let deletedDayKey: string | null = null
      const newExpenses = context.expenses.map((e) => {
        if (e.id !== event.id) return e
        updatedExpense = { ...e, deletedAt: now, updatedAt: now }
        deletedDayKey = getLocalDayKey(e.date)
        return updatedExpense
      })
      let dirtyDays = context.dirtyDays
      let deletedDays = context.deletedDays
      if (deletedDayKey) {
        dirtyDays = addUniqueDay(dirtyDays, deletedDayKey)
        deletedDays = addUniqueDay(deletedDays, deletedDayKey)
      }

      enqueue.effect(async () => {
        if (updatedExpense) {
          await persistExpenseUpdated(updatedExpense)
        }
        if (deletedDayKey) {
          await markDeletedDay(deletedDayKey)
        }
        await performAutoSyncOnChange(newExpenses, createAutoSyncCallbacks())
      })

      return { ...context, expenses: newExpenses, dirtyDays, deletedDays }
    },

    replaceExpenses: (context, event: { expenses: Expense[] }, enqueue) => {
      enqueue.effect(async () => {
        await persistExpensesSnapshot(event.expenses)
        // Clean up legacy key after a successful full snapshot write.
        await removeLegacyExpensesKey()
      })

      return {
        ...context,
        expenses: event.expenses,
      }
    },

    setSyncNotification: (
      context,
      event: { notification: SyncNotification | null },
      enqueue
    ) => {
      if (event.notification) {
        enqueue.effect(() => {
          // Emit event for listeners (store provider will handle routing to notification store)
          emitSyncNotification(event.notification!)

          // Auto-clear after brief delay
          setTimeout(() => {
            expenseStore.trigger.clearSyncNotification()
          }, 500)
        })
      }
      return {
        ...context,
        syncNotification: event.notification,
      }
    },

    clearSyncNotification: (context) => ({
      ...context,
      syncNotification: null,
    }),

    clearDirtyDaysState: (context) => ({
      ...context,
      dirtyDays: [],
      deletedDays: [],
    }),

    clearDirtyDaysAfterSync: (context, _event, enqueue) => {
      enqueue.effect(async () => {
        await clearDirtyDays()
      })
      return {
        ...context,
        dirtyDays: [],
        deletedDays: [],
      }
    },

    reassignExpensesToOther: (context, event: { fromCategory: string }, enqueue) => {
      const now = new Date().toISOString()
      const affectedExpenseIds: string[] = []
      const affectedExpenses: Expense[] = []
      const affectedDays: string[] = []

      // Update all expenses with the deleted category to "Other"
      const newExpenses = context.expenses.map((expense) => {
        if (expense.category === event.fromCategory && !expense.deletedAt) {
          affectedExpenseIds.push(expense.id)
          affectedDays.push(getLocalDayKey(expense.date))
          const updated = {
            ...expense,
            category: "Other",
            updatedAt: now,
          }
          affectedExpenses.push(updated)
          return updated
        }
        return expense
      })

      const dirtyDays = addUniqueDays(context.dirtyDays, affectedDays)

      enqueue.effect(async () => {
        // Persist only affected expenses (avoid full-array rewrite)
        if (affectedExpenses.length > 0) {
          await persistExpensesUpdated(affectedExpenses)
        }

        for (const dayKey of new Set(affectedDays)) {
          await markDirtyDay(dayKey)
        }

        // Trigger auto-sync if enabled for on_change timing
        if (affectedExpenseIds.length > 0) {
          await performAutoSyncOnChange(newExpenses, createAutoSyncCallbacks())
        }
      })

      return { ...context, expenses: newExpenses, dirtyDays }
    },

    updateExpenseCategories: (
      context,
      event: { fromCategory: string; toCategory: string },
      enqueue
    ) => {
      // Handle same-name rename as no-op
      const fromCategory = event.fromCategory.trim()
      const toCategory = event.toCategory.trim()
      if (fromCategory === toCategory) {
        return context
      }

      const now = new Date().toISOString()
      const affectedExpenseIds: string[] = []
      const affectedExpenses: Expense[] = []
      const affectedDays: string[] = []

      // Update all active expenses with the old category to use the new category
      const newExpenses = context.expenses.map((expense) => {
        if (expense.category === fromCategory && !expense.deletedAt) {
          affectedExpenseIds.push(expense.id)
          affectedDays.push(getLocalDayKey(expense.date))
          const updated = {
            ...expense,
            category: toCategory,
            updatedAt: now,
          }
          affectedExpenses.push(updated)
          return updated
        }
        return expense
      })

      const dirtyDays = addUniqueDays(context.dirtyDays, affectedDays)

      enqueue.effect(async () => {
        // Persist only affected expenses (avoid full-array rewrite)
        if (affectedExpenses.length > 0) {
          await persistExpensesUpdated(affectedExpenses)
        }

        for (const dayKey of new Set(affectedDays)) {
          await markDirtyDay(dayKey)
        }

        // Trigger auto-sync if enabled for on_change timing
        if (affectedExpenseIds.length > 0) {
          await performAutoSyncOnChange(newExpenses, createAutoSyncCallbacks())
        }
      })

      return { ...context, expenses: newExpenses, dirtyDays }
    },
  },
})

// Exported initialization function - call from React component tree
export async function initializeExpenseStore(): Promise<void> {
  try {
    const loaded = await loadAllExpensesFromStorage()
    const expenses = loaded.expenses

    // One-time migration: if we loaded from legacy storage, migrate to v1 and remove legacy key.
    if (loaded.source === "legacy") {
      await migrateLegacyExpensesToV1(expenses)
      await removeLegacyExpensesKey()
    }

    const dirtyDaysResult = await loadDirtyDays()

    expenseStore.trigger.loadExpenses({
      expenses,
      dirtyDays: dirtyDaysResult.state.dirtyDays,
      deletedDays: dirtyDaysResult.state.deletedDays,
    })

    // Perform auto-sync on launch using the helper
    await performAutoSyncOnLaunch(expenses, createAutoSyncCallbacks())
  } catch (error) {
    console.warn("Failed to initialize expense store:", error)
    expenseStore.trigger.loadExpenses({ expenses: [] })
  }
}

export type ExpenseStore = typeof expenseStore

/**
 * Filter out soft-deleted expenses for display purposes.
 * Expenses with a deletedAt timestamp are considered deleted and should not be shown to users.
 */
export function getActiveExpenses(expenses: Expense[]): Expense[] {
  return expenses.filter((expense) => !expense.deletedAt)
}

/**
 * Check if an expense is soft-deleted
 */
export function isExpenseDeleted(expense: Expense): boolean {
  return !!expense.deletedAt
}
