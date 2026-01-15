import { useCallback, useMemo } from "react"
import { useSelector } from "@xstate/store/react"
import { useStoreContext } from "./store-provider"
import {
  selectEffectiveTheme,
  selectHasUnsyncedChanges,
  selectCategoryByLabel,
} from "./settings-store"
import { Expense } from "../types/expense"
import {
  ThemePreference,
  AppSettings,
  AutoSyncTiming,
} from "../services/settings-manager"
import { PaymentMethodType } from "../types/expense"
import { NotificationType } from "./notification-store"
import { SyncConfig } from "../services/sync-manager"
import { Category } from "../types/category"

// Import for helper function only
import { getActiveExpenses } from "./expense-store"

// Expense hooks
export const useExpenses = () => {
  const { expenseStore } = useStoreContext()

  // Use the store from context for useSelector to ensure proper subscription
  const expenses = useSelector(expenseStore, (state) => state.context.expenses)
  const isLoading = useSelector(expenseStore, (state) => state.context.isLoading)
  const syncNotification = useSelector(
    expenseStore,
    (state) => state.context.syncNotification
  )
  const pendingChanges = useSelector(
    expenseStore,
    (state) => state.context.pendingChanges
  )

  // Memoized: Filter out soft-deleted expenses for display
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
    // state.expenses contains ALL expenses (including soft-deleted) for sync operations
    // state.activeExpenses contains only non-deleted expenses for display
    state: { expenses, activeExpenses, isLoading, syncNotification, pendingChanges },
    addExpense,
    editExpense,
    deleteExpense,
    replaceAllExpenses,
    clearSyncNotification,
    clearPendingChangesAfterSync,
    reassignExpensesToOther,
    updateExpenseCategories,
  }
}

// Settings hooks
export const useSettings = () => {
  const { settingsStore } = useStoreContext()

  // Use the store from context for useSelector to ensure proper subscription
  const settings = useSelector(settingsStore, (state) => state.context.settings)
  const isLoading = useSelector(settingsStore, (state) => state.context.isLoading)
  const hasUnsyncedChanges = useSelector(settingsStore, (state) =>
    selectHasUnsyncedChanges(state.context)
  )
  const effectiveTheme = useSelector(settingsStore, (state) =>
    selectEffectiveTheme(state.context)
  )
  const syncConfig = useSelector(settingsStore, (state) => state.context.syncConfig)
  const paymentMethodSectionExpanded = useSelector(
    settingsStore,
    (state) => state.context.paymentMethodSectionExpanded
  )
  const paymentInstrumentsSectionExpanded = useSelector(
    settingsStore,
    (state) => state.context.paymentInstrumentsSectionExpanded
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

  const setPaymentMethodExpanded = useCallback(
    (expanded: boolean) => settingsStore.trigger.setPaymentMethodExpanded({ expanded }),
    [settingsStore]
  )

  const setPaymentInstrumentsExpanded = useCallback(
    (expanded: boolean) =>
      settingsStore.trigger.setPaymentInstrumentsExpanded({ expanded }),
    [settingsStore]
  )

  const saveSyncConfig = useCallback(
    (config: SyncConfig) => settingsStore.trigger.saveSyncConfig({ config }),
    [settingsStore]
  )

  const clearSyncConfig = useCallback(
    () => settingsStore.trigger.clearSyncConfig(),
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
    syncConfig,
    paymentMethodSectionExpanded,
    paymentInstrumentsSectionExpanded,
    setTheme,
    setSyncSettings,
    setDefaultPaymentMethod,
    setAutoSyncEnabled,
    setAutoSyncTiming,
    updateSettings,
    replaceSettings,
    clearSettingsChangeFlag,
    setPaymentMethodExpanded,
    setPaymentInstrumentsExpanded,
    saveSyncConfig,
    clearSyncConfig,
  }
}

// Narrow hook for theme-only consumers (e.g. providers/layout) to avoid rerendering
// the whole app tree on unrelated settings changes.
export const useThemeSettings = () => {
  const { settingsStore } = useStoreContext()

  const isLoading = useSelector(settingsStore, (state) => state.context.isLoading)
  const effectiveTheme = useSelector(settingsStore, (state) =>
    selectEffectiveTheme(state.context)
  )

  return { isLoading, effectiveTheme }
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

// Category hooks
export const useCategories = () => {
  const { settingsStore, expenseStore } = useStoreContext()

  // Use the store from context for useSelector to ensure proper subscription
  const rawCategories = useSelector(
    settingsStore,
    (state) => state.context.settings.categories
  )

  // Sort categories in useMemo to maintain stable reference
  // "Other" category is always sorted to the end, regardless of its order value
  const categories = useMemo(
    () =>
      [...rawCategories].sort((a, b) => {
        // "Other" always goes to the end
        if (a.label === "Other") return 1
        if (b.label === "Other") return -1
        // Otherwise sort by order
        return a.order - b.order
      }),
    [rawCategories]
  )

  // Get a category by label
  const getCategoryByLabel = useCallback(
    (label: string): Category | undefined => {
      const state = settingsStore.getSnapshot()
      return selectCategoryByLabel(state.context, label)
    },
    [settingsStore]
  )

  // Add a new category
  const addCategory = useCallback(
    (category: Omit<Category, "order" | "updatedAt">) => {
      settingsStore.trigger.addCategory({ category })
    },
    [settingsStore]
  )

  // Update an existing category
  // If the label is being changed, also update all expenses that reference the old label
  const updateCategory = useCallback(
    (label: string, updates: Partial<Omit<Category, "updatedAt">>) => {
      // If label is being changed, update expenses first
      const nextLabel = updates.label?.trim()
      if (nextLabel && nextLabel !== label) {
        expenseStore.trigger.updateExpenseCategories({
          fromCategory: label,
          toCategory: nextLabel,
        })
      }
      settingsStore.trigger.updateCategory({ label, updates })
    },
    [settingsStore, expenseStore]
  )

  // Delete a category
  const deleteCategory = useCallback(
    (label: string) => {
      settingsStore.trigger.deleteCategory({ label })
    },
    [settingsStore]
  )

  // Reorder categories
  const reorderCategories = useCallback(
    (labels: string[]) => {
      settingsStore.trigger.reorderCategories({ labels })
    },
    [settingsStore]
  )

  // Replace all categories (for sync)
  const replaceCategories = useCallback(
    (newCategories: Category[]) => {
      settingsStore.trigger.replaceCategories({ categories: newCategories })
    },
    [settingsStore]
  )

  return {
    categories,
    getCategoryByLabel,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    replaceCategories,
  }
}
