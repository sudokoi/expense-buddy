import { createStore } from "@xstate/store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Expense } from "../types/expense"
import { SyncNotification } from "../services/sync-manager"
import {
  trackAdd,
  trackEdit,
  trackDelete,
  clearPendingChanges,
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

    addExpense: (context, event: { expense: Expense }, enqueue) => {
      const newExpenses = [event.expense, ...context.expenses]

      enqueue.effect(async () => {
        await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(newExpenses))
        await trackAdd(event.expense.id)

        const shouldSync = await shouldAutoSyncForTiming("on_change")
        if (shouldSync) {
          const result = await performAutoSyncIfEnabled(newExpenses)
          if (result.synced && result.expenses) {
            expenseStore.trigger.replaceExpenses({ expenses: result.expenses })
            await clearPendingChanges()
            if (result.notification) {
              expenseStore.trigger.setSyncNotification({
                notification: result.notification,
              })
            }
          }
        }
      })

      return { ...context, expenses: newExpenses }
    },

    editExpense: (context, event: { expense: Expense }, enqueue) => {
      const newExpenses = context.expenses.map((e) =>
        e.id === event.expense.id ? event.expense : e
      )

      enqueue.effect(async () => {
        await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(newExpenses))
        await trackEdit(event.expense.id)

        const shouldSync = await shouldAutoSyncForTiming("on_change")
        if (shouldSync) {
          const result = await performAutoSyncIfEnabled(newExpenses)
          if (result.synced && result.expenses) {
            expenseStore.trigger.replaceExpenses({ expenses: result.expenses })
            await clearPendingChanges()
            if (result.notification) {
              expenseStore.trigger.setSyncNotification({
                notification: result.notification,
              })
            }
          }
        }
      })

      return { ...context, expenses: newExpenses }
    },

    deleteExpense: (context, event: { id: string }, enqueue) => {
      const newExpenses = context.expenses.filter((e) => e.id !== event.id)

      enqueue.effect(async () => {
        await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(newExpenses))
        await trackDelete(event.id)

        const shouldSync = await shouldAutoSyncForTiming("on_change")
        if (shouldSync) {
          const result = await performAutoSyncIfEnabled(newExpenses)
          if (result.synced && result.expenses) {
            expenseStore.trigger.replaceExpenses({ expenses: result.expenses })
            await clearPendingChanges()
            if (result.notification) {
              expenseStore.trigger.setSyncNotification({
                notification: result.notification,
              })
            }
          }
        }
      })

      return { ...context, expenses: newExpenses }
    },

    replaceExpenses: (context, event: { expenses: Expense[] }, enqueue) => {
      enqueue.effect(async () => {
        await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(event.expenses))
      })

      return { ...context, expenses: event.expenses }
    },

    setSyncNotification: (context, event: { notification: SyncNotification | null }) => ({
      ...context,
      syncNotification: event.notification,
    }),

    clearSyncNotification: (context) => ({
      ...context,
      syncNotification: null,
    }),

    clearPendingChangesAfterSync: (context, _event, enqueue) => {
      enqueue.effect(async () => {
        await clearPendingChanges()
      })
      return context
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

// Initialize store on module load
async function initializeExpenseStore(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(EXPENSES_KEY)
    const expenses = stored ? JSON.parse(stored) : []
    expenseStore.trigger.loadExpenses({ expenses })

    const shouldSync = await shouldAutoSyncForTiming("on_launch")
    if (shouldSync) {
      const result = await performAutoSyncIfEnabled(expenses)
      if (result.synced && result.expenses) {
        expenseStore.trigger.replaceExpenses({ expenses: result.expenses })
        await clearPendingChanges()
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
  } catch {
    expenseStore.trigger.loadExpenses({ expenses: [] })
  }
}

initializeExpenseStore()

export type ExpenseStore = typeof expenseStore
