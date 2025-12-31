import React, { createContext, useContext, useMemo } from "react"
import { expenseStore as defaultExpenseStore, ExpenseStore } from "./expense-store"
import { settingsStore as defaultSettingsStore, SettingsStore } from "./settings-store"
import {
  notificationStore as defaultNotificationStore,
  NotificationStore,
} from "./notification-store"
import {
  syncStatusStore as defaultSyncStatusStore,
  SyncStatusStore,
} from "./sync-status-store"

interface StoreContextValue {
  expenseStore: ExpenseStore
  settingsStore: SettingsStore
  notificationStore: NotificationStore
  syncStatusStore: SyncStatusStore
}

const StoreContext = createContext<StoreContextValue | null>(null)

interface StoreProviderProps {
  children: React.ReactNode
  // Optional overrides for testing
  expenseStore?: ExpenseStore
  settingsStore?: SettingsStore
  notificationStore?: NotificationStore
  syncStatusStore?: SyncStatusStore
}

export const StoreProvider: React.FC<StoreProviderProps> = ({
  children,
  expenseStore = defaultExpenseStore,
  settingsStore = defaultSettingsStore,
  notificationStore = defaultNotificationStore,
  syncStatusStore = defaultSyncStatusStore,
}) => {
  const value = useMemo(
    () => ({
      expenseStore,
      settingsStore,
      notificationStore,
      syncStatusStore,
    }),
    [expenseStore, settingsStore, notificationStore, syncStatusStore]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// Hook to access the store context
export const useStoreContext = () => {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error("useStoreContext must be used within a StoreProvider")
  }
  return context
}
