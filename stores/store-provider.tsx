import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react"
import {
  expenseStore as defaultExpenseStore,
  ExpenseStore,
  initializeExpenseStore,
  onSyncNotification,
} from "./expense-store"
import {
  settingsStore as defaultSettingsStore,
  SettingsStore,
  initializeSettingsStore,
} from "./settings-store"
import {
  notificationStore as defaultNotificationStore,
  NotificationStore,
} from "./notification-store"

interface StoreContextValue {
  expenseStore: ExpenseStore
  settingsStore: SettingsStore
  notificationStore: NotificationStore
}

const StoreContext = createContext<StoreContextValue | null>(null)

interface StoreProviderProps {
  children: React.ReactNode
  // Optional overrides for testing
  expenseStore?: ExpenseStore
  settingsStore?: SettingsStore
  notificationStore?: NotificationStore
  // Skip initialization (for testing)
  skipInitialization?: boolean
}

export const StoreProvider: React.FC<StoreProviderProps> = ({
  children,
  expenseStore = defaultExpenseStore,
  settingsStore = defaultSettingsStore,
  notificationStore = defaultNotificationStore,
  skipInitialization = false,
}) => {
  const initializedRef = useRef(false)

  // Initialize stores when component mounts (inside React tree where RN is ready)
  useEffect(() => {
    if (skipInitialization || initializedRef.current) return
    initializedRef.current = true

    // Initialize stores - AsyncStorage is safe to use here
    initializeSettingsStore()
    initializeExpenseStore()
  }, [skipInitialization])

  // Memoize the notification handler to avoid recreating on every render
  const handleSyncNotification = useCallback(
    (notification: {
      newItemsCount: number
      updatedItemsCount: number
      message: string
    }) => {
      const message = `${notification.message}: ${notification.newItemsCount} new, ${notification.updatedItemsCount} updated`
      notificationStore.trigger.addNotification({
        message,
        notificationType: "success",
        duration: 4000,
      })
    },
    [notificationStore]
  )

  // Subscribe to sync notification events and route to notification store
  useEffect(() => {
    const unsubscribe = onSyncNotification(handleSyncNotification)
    return unsubscribe
  }, [handleSyncNotification])

  const value = useMemo(
    () => ({
      expenseStore,
      settingsStore,
      notificationStore,
    }),
    [expenseStore, settingsStore, notificationStore]
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
