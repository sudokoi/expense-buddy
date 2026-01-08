import { createStore } from "@xstate/store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Expense } from "../types/expense"
import { SyncNotification } from "../services/sync-manager"
import {
  trackAdd,
  trackEdit,
  trackDelete,
  clearPendingChanges,
  loadPendingChanges,
} from "../services/change-tracker"
import { AppSettings } from "../services/settings-manager"
import {
  performAutoSyncOnChange,
  performAutoSyncOnLaunch,
  AutoSyncCallbacks,
} from "./helpers"

const EXPENSES_KEY = "expenses"

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
    onPendingChangesCleared: () => {
      expenseStore.trigger.clearPendingChangesCount()
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
    pendingChanges: {
      added: 0,
      edited: 0,
      deleted: 0,
    },
  },

  on: {
    loadExpenses: (
      context,
      event: {
        expenses: Expense[]
        pendingChanges?: { added: number; edited: number; deleted: number }
      }
    ) => ({
      ...context,
      expenses: event.expenses,
      isLoading: false,
      pendingChanges: event.pendingChanges ?? context.pendingChanges,
    }),

    setLoading: (context, event: { isLoading: boolean }) => ({
      ...context,
      isLoading: event.isLoading,
    }),

    addExpense: (context, event: { expense: Expense }, enqueue) => {
      const newExpenses = [event.expense, ...context.expenses]
      const newPendingChanges = {
        ...context.pendingChanges,
        added: context.pendingChanges.added + 1,
      }

      enqueue.effect(async () => {
        await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(newExpenses))
        await trackAdd(event.expense.id)
        await performAutoSyncOnChange(newExpenses, createAutoSyncCallbacks())
      })

      return { ...context, expenses: newExpenses, pendingChanges: newPendingChanges }
    },

    editExpense: (context, event: { expense: Expense }, enqueue) => {
      const newExpenses = context.expenses.map((e) =>
        e.id === event.expense.id ? event.expense : e
      )
      // Only increment edited if not already in added set (tracked via change-tracker)
      // For simplicity, we increment here - the actual tracking is in change-tracker
      const newPendingChanges = {
        ...context.pendingChanges,
        edited: context.pendingChanges.edited + 1,
      }

      enqueue.effect(async () => {
        await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(newExpenses))
        await trackEdit(event.expense.id)
        await performAutoSyncOnChange(newExpenses, createAutoSyncCallbacks())
      })

      return { ...context, expenses: newExpenses, pendingChanges: newPendingChanges }
    },

    deleteExpense: (context, event: { id: string }, enqueue) => {
      const now = new Date().toISOString()
      // Soft delete: mark with deletedAt timestamp instead of removing
      const newExpenses = context.expenses.map((e) =>
        e.id === event.id ? { ...e, deletedAt: now, updatedAt: now } : e
      )
      const newPendingChanges = {
        ...context.pendingChanges,
        deleted: context.pendingChanges.deleted + 1,
      }

      enqueue.effect(async () => {
        await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(newExpenses))
        await trackDelete(event.id)
        await performAutoSyncOnChange(newExpenses, createAutoSyncCallbacks())
      })

      return { ...context, expenses: newExpenses, pendingChanges: newPendingChanges }
    },

    replaceExpenses: (context, event: { expenses: Expense[] }, enqueue) => {
      enqueue.effect(async () => {
        await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(event.expenses))
      })

      return { ...context, expenses: event.expenses }
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

    clearPendingChangesCount: (context) => ({
      ...context,
      pendingChanges: { added: 0, edited: 0, deleted: 0 },
    }),

    clearPendingChangesAfterSync: (context, _event, enqueue) => {
      enqueue.effect(async () => {
        await clearPendingChanges()
      })
      return {
        ...context,
        pendingChanges: { added: 0, edited: 0, deleted: 0 },
      }
    },

    reassignExpensesToOther: (context, event: { fromCategory: string }, enqueue) => {
      const now = new Date().toISOString()
      const affectedExpenseIds: string[] = []

      // Update all expenses with the deleted category to "Other"
      const newExpenses = context.expenses.map((expense) => {
        if (expense.category === event.fromCategory && !expense.deletedAt) {
          affectedExpenseIds.push(expense.id)
          return {
            ...expense,
            category: "Other",
            updatedAt: now,
          }
        }
        return expense
      })

      // Calculate new pending changes count (each affected expense counts as an edit)
      const newPendingChanges = {
        ...context.pendingChanges,
        edited: context.pendingChanges.edited + affectedExpenseIds.length,
      }

      enqueue.effect(async () => {
        // Persist the updated expenses
        await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(newExpenses))

        // Track each affected expense as edited for sync
        for (const id of affectedExpenseIds) {
          await trackEdit(id)
        }

        // Trigger auto-sync if enabled for on_change timing
        if (affectedExpenseIds.length > 0) {
          await performAutoSyncOnChange(newExpenses, createAutoSyncCallbacks())
        }
      })

      return { ...context, expenses: newExpenses, pendingChanges: newPendingChanges }
    },

    updateExpenseCategories: (
      context,
      event: { fromCategory: string; toCategory: string },
      enqueue
    ) => {
      // Handle same-name rename as no-op
      if (event.fromCategory === event.toCategory) {
        return context
      }

      const now = new Date().toISOString()
      const affectedExpenseIds: string[] = []

      // Update all active expenses with the old category to use the new category
      const newExpenses = context.expenses.map((expense) => {
        if (expense.category === event.fromCategory && !expense.deletedAt) {
          affectedExpenseIds.push(expense.id)
          return {
            ...expense,
            category: event.toCategory,
            updatedAt: now,
          }
        }
        return expense
      })

      // Calculate new pending changes count (each affected expense counts as an edit)
      const newPendingChanges = {
        ...context.pendingChanges,
        edited: context.pendingChanges.edited + affectedExpenseIds.length,
      }

      enqueue.effect(async () => {
        // Persist the updated expenses
        await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(newExpenses))

        // Track each affected expense as edited for sync
        for (const id of affectedExpenseIds) {
          await trackEdit(id)
        }

        // Trigger auto-sync if enabled for on_change timing
        if (affectedExpenseIds.length > 0) {
          await performAutoSyncOnChange(newExpenses, createAutoSyncCallbacks())
        }
      })

      return { ...context, expenses: newExpenses, pendingChanges: newPendingChanges }
    },
  },
})

// Exported initialization function - call from React component tree
export async function initializeExpenseStore(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(EXPENSES_KEY)
    const expenses = stored ? JSON.parse(stored) : []

    // Load pending changes from storage
    const pendingChangesData = await loadPendingChanges()
    const pendingChanges = {
      added: pendingChangesData.added.size,
      edited: pendingChangesData.edited.size,
      deleted: pendingChangesData.deleted.size,
    }

    expenseStore.trigger.loadExpenses({ expenses, pendingChanges })

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
