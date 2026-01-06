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
import {
  performAutoSyncIfEnabled,
  shouldAutoSyncForTiming,
} from "../services/auto-sync-service"
import { AppSettings } from "../services/settings-manager"

const EXPENSES_KEY = "expenses"

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

        const shouldSync = await shouldAutoSyncForTiming("on_change")
        if (shouldSync) {
          const result = await performAutoSyncIfEnabled(newExpenses)
          if (result.synced && result.expenses) {
            expenseStore.trigger.replaceExpenses({ expenses: result.expenses })
            await clearPendingChanges()
            expenseStore.trigger.clearPendingChangesCount()
            if (result.notification) {
              expenseStore.trigger.setSyncNotification({
                notification: result.notification,
              })
            }
          }
        }
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

        const shouldSync = await shouldAutoSyncForTiming("on_change")
        if (shouldSync) {
          const result = await performAutoSyncIfEnabled(newExpenses)
          if (result.synced && result.expenses) {
            expenseStore.trigger.replaceExpenses({ expenses: result.expenses })
            await clearPendingChanges()
            expenseStore.trigger.clearPendingChangesCount()
            if (result.notification) {
              expenseStore.trigger.setSyncNotification({
                notification: result.notification,
              })
            }
          }
        }
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

        const shouldSync = await shouldAutoSyncForTiming("on_change")
        if (shouldSync) {
          const result = await performAutoSyncIfEnabled(newExpenses)
          if (result.synced && result.expenses) {
            expenseStore.trigger.replaceExpenses({ expenses: result.expenses })
            await clearPendingChanges()
            expenseStore.trigger.clearPendingChangesCount()
            if (result.notification) {
              expenseStore.trigger.setSyncNotification({
                notification: result.notification,
              })
            }
          }
        }
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
  },
})

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

    const shouldSync = await shouldAutoSyncForTiming("on_launch")
    if (shouldSync) {
      const result = await performAutoSyncIfEnabled(expenses)
      if (result.synced && result.expenses) {
        expenseStore.trigger.replaceExpenses({ expenses: result.expenses })
        await clearPendingChanges()
        expenseStore.trigger.clearPendingChangesCount()
        if (result.downloadedSettings) {
          emitSettingsDownloaded(result.downloadedSettings)
        }
        if (result.notification) {
          expenseStore.trigger.setSyncNotification({ notification: result.notification })
        }
      } else if (result.downloadedSettings) {
        emitSettingsDownloaded(result.downloadedSettings)
      }
    }
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
