// Store Provider
export { StoreProvider, useStoreContext } from "./store-provider"

// Hooks
export { useExpenses, useSettings, useNotifications, useCategories } from "./hooks"

// Store instances (for direct access if needed)
export {
  expenseStore,
  onSettingsDownloaded,
  emitSettingsDownloaded,
  initializeExpenseStore,
} from "./expense-store"
export {
  settingsStore,
  selectEffectiveTheme,
  selectCategories,
  selectCategoryByLabel,
  initializeSettingsStore,
} from "./settings-store"
export { notificationStore } from "./notification-store"

// Types
export type { ExpenseStore } from "./expense-store"
export type { SettingsStore } from "./settings-store"
export type {
  NotificationStore,
  Notification,
  NotificationType,
} from "./notification-store"
