// Store Provider
export { StoreProvider, useStoreContext } from "./store-provider"

// Hooks
export { useExpenses, useSettings, useNotifications, useSyncStatus } from "./hooks"

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
  initializeSettingsStore,
} from "./settings-store"
export { notificationStore } from "./notification-store"
export { syncStatusStore, selectIsSyncing } from "./sync-status-store"

// Types
export type { ExpenseStore } from "./expense-store"
export type { SettingsStore } from "./settings-store"
export type {
  NotificationStore,
  Notification,
  NotificationType,
} from "./notification-store"
export type { SyncStatusStore, SyncStatus } from "./sync-status-store"
