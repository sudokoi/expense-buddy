import { useCallback } from "react"
import { useSelector } from "@xstate/store/react"
import { useStoreContext } from "./store-provider"
import { selectEffectiveTheme } from "./settings-store"
import { selectIsSyncing, SyncStatus } from "./sync-status-store"
import { Expense } from "../types/expense"
import {
  ThemePreference,
  AppSettings,
  AutoSyncTiming,
} from "../services/settings-manager"
import { PaymentMethodType } from "../types/expense"
import { NotificationType } from "./notification-store"

// Import stores directly for useSelector type inference
import { expenseStore as defaultExpenseStore } from "./expense-store"
import { settingsStore as defaultSettingsStore } from "./settings-store"
import { syncStatusStore as defaultSyncStatusStore } from "./sync-status-store"

// Expense hooks
export const useExpenses = () => {
  const { expenseStore } = useStoreContext()

  // Use default store for type inference, but the actual store from context
  const expenses = useSelector(defaultExpenseStore, (state) => state.context.expenses)
  const isLoading = useSelector(defaultExpenseStore, (state) => state.context.isLoading)
  const syncNotification = useSelector(
    defaultExpenseStore,
    (state) => state.context.syncNotification
  )

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

  const clearPendingChangesAfterSync = useCallback(
    () => expenseStore.trigger.clearPendingChangesAfterSync(),
    [expenseStore]
  )

  return {
    state: { expenses, isLoading, syncNotification },
    addExpense,
    editExpense,
    deleteExpense,
    replaceAllExpenses,
    clearSyncNotification,
    clearPendingChangesAfterSync,
  }
}

// Settings hooks
export const useSettings = () => {
  const { settingsStore } = useStoreContext()

  const settings = useSelector(defaultSettingsStore, (state) => state.context.settings)
  const isLoading = useSelector(defaultSettingsStore, (state) => state.context.isLoading)
  const hasUnsyncedChanges = useSelector(
    defaultSettingsStore,
    (state) => state.context.hasUnsyncedChanges
  )
  const effectiveTheme = useSelector(defaultSettingsStore, (state) =>
    selectEffectiveTheme(state.context)
  )

  const setTheme = useCallback(
    (theme: ThemePreference) => settingsStore.trigger.setTheme({ theme }),
    [settingsStore]
  )

  const setSyncSettings = useCallback(
    (enabled: boolean) => settingsStore.trigger.setSyncSettings({ enabled }),
    [settingsStore]
  )

  const setDefaultPaymentMethod = useCallback(
    (paymentMethod: PaymentMethodType | undefined) =>
      settingsStore.trigger.setDefaultPaymentMethod({ paymentMethod }),
    [settingsStore]
  )

  const setAutoSyncEnabled = useCallback(
    (enabled: boolean) => settingsStore.trigger.setAutoSyncEnabled({ enabled }),
    [settingsStore]
  )

  const setAutoSyncTiming = useCallback(
    (timing: AutoSyncTiming) => settingsStore.trigger.setAutoSyncTiming({ timing }),
    [settingsStore]
  )

  const updateSettings = useCallback(
    (updates: Partial<AppSettings>) => settingsStore.trigger.updateSettings({ updates }),
    [settingsStore]
  )

  const replaceSettings = useCallback(
    (newSettings: AppSettings) =>
      settingsStore.trigger.replaceSettings({ settings: newSettings }),
    [settingsStore]
  )

  const clearSettingsChangeFlag = useCallback(
    () => settingsStore.trigger.clearSettingsChangeFlag(),
    [settingsStore]
  )

  return {
    settings,
    isLoading,
    effectiveTheme,
    hasUnsyncedChanges,
    defaultPaymentMethod: settings.defaultPaymentMethod,
    autoSyncEnabled: settings.autoSyncEnabled,
    autoSyncTiming: settings.autoSyncTiming,
    setTheme,
    setSyncSettings,
    setDefaultPaymentMethod,
    setAutoSyncEnabled,
    setAutoSyncTiming,
    updateSettings,
    replaceSettings,
    clearSettingsChangeFlag,
  }
}

// Notification hooks
export const useNotifications = () => {
  const { notificationStore } = useStoreContext()

  // Use the store from context for useSelector to ensure proper subscription
  const notifications = useSelector(
    notificationStore,
    (state) => state.context.notifications
  )

  const addNotification = useCallback(
    (message: string, notificationType?: NotificationType, duration?: number) => {
      const eventPayload: {
        message: string
        notificationType?: NotificationType
        duration?: number
      } = { message }
      if (notificationType !== undefined) {
        eventPayload.notificationType = notificationType
      }
      if (duration !== undefined) {
        eventPayload.duration = duration
      }
      notificationStore.trigger.addNotification(eventPayload)
    },
    [notificationStore]
  )

  const removeNotification = useCallback(
    (id: string) => notificationStore.trigger.removeNotification({ id }),
    [notificationStore]
  )

  return {
    notifications,
    addNotification,
    removeNotification,
  }
}

// Sync status hooks
export const useSyncStatus = () => {
  const { syncStatusStore } = useStoreContext()

  const syncStatus = useSelector(
    defaultSyncStatusStore,
    (state) => state.context.syncStatus
  )
  const isSyncing = useSelector(defaultSyncStatusStore, (state) =>
    selectIsSyncing(state.context)
  )

  const setSyncStatus = useCallback(
    (status: SyncStatus) => syncStatusStore.trigger.setStatus({ status }),
    [syncStatusStore]
  )

  const startSync = useCallback(
    () => syncStatusStore.trigger.startSync(),
    [syncStatusStore]
  )

  const endSync = useCallback(
    (success: boolean) => syncStatusStore.trigger.endSync({ success }),
    [syncStatusStore]
  )

  return {
    syncStatus,
    isSyncing,
    setSyncStatus,
    startSync,
    endSync,
  }
}
