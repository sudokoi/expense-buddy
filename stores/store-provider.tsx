import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react"
import { createActor, ActorRefFrom } from "xstate"
import {
  expenseStore as defaultExpenseStore,
  ExpenseStore,
  initializeExpenseStore,
  onSettingsDownloaded,
  onSyncNotification,
} from "./expense-store"
import { SyncNotification } from "../types/sync"
import {
  settingsStore as defaultSettingsStore,
  SettingsStore,
  initializeSettingsStore,
} from "./settings-store"
import {
  uiStateStore as defaultUIStateStore,
  UIStateStore,
  initializeUIStateStore,
} from "./ui-state-store"
import {
  cleanupUpdateStore,
  initializeUpdateStore,
  runLaunchUpdateCheck,
  updateStore as defaultUpdateStore,
  UpdateStore,
} from "./update-store"
import {
  notificationStore as defaultNotificationStore,
  NotificationStore,
} from "./notification-store"
import { syncMachine } from "../services/sync-machine"
import { githubAuthMachine } from "../services/github-auth-machine"
import { migratePaymentInstrumentsOnStartup } from "../services/payment-instruments-migration"
import { requestBackgroundSmsPermissions } from "../services/background-sms/background-sms-permissions"
import { DeferredProvider } from "../services/sync/deferred-provider"
import { createProvider } from "../services/sync/provider-registry"
import { getActiveProviderConfig } from "../services/sync-config"

// Register provider factories at import time
import "../services/sync"

interface StoreContextValue {
  expenseStore: ExpenseStore
  settingsStore: SettingsStore
  notificationStore: NotificationStore
  uiStateStore: UIStateStore
  updateStore: UpdateStore
  syncActor: ActorRefFrom<typeof syncMachine>
  githubAuthActor: ActorRefFrom<typeof githubAuthMachine>
}

const StoreContext = createContext<StoreContextValue | null>(null)

interface StoreProviderProps {
  children: React.ReactNode
  // Optional overrides for testing
  expenseStore?: ExpenseStore
  settingsStore?: SettingsStore
  notificationStore?: NotificationStore
  uiStateStore?: UIStateStore
  updateStore?: UpdateStore
  syncActor?: ActorRefFrom<typeof syncMachine>
  githubAuthActor?: ActorRefFrom<typeof githubAuthMachine>
  // Skip initialization (for testing)
  skipInitialization?: boolean
}

export const StoreProvider: React.FC<StoreProviderProps> = ({
  children,
  expenseStore = defaultExpenseStore,
  settingsStore = defaultSettingsStore,
  notificationStore = defaultNotificationStore,
  uiStateStore = defaultUIStateStore,
  updateStore = defaultUpdateStore,
  syncActor: providedSyncActor,
  githubAuthActor: providedGitHubAuthActor,
  skipInitialization = false,
}) => {
  const initializedRef = useRef(false)
  const deferredProviderRef = useRef<DeferredProvider | null>(null)

  // Create sync actor once on mount (using ref to avoid recreating)
  const syncActorRef = useRef<ActorRefFrom<typeof syncMachine> | null>(null)
  if (!syncActorRef.current && !providedSyncActor) {
    const deferredProvider = new DeferredProvider()
    deferredProviderRef.current = deferredProvider
    syncActorRef.current = createActor(syncMachine, {
      input: { provider: deferredProvider },
    })
    syncActorRef.current.start()
  }
  const syncActor = providedSyncActor ?? syncActorRef.current!

  // Create GitHub auth actor once on mount
  const githubAuthActorRef = useRef<ActorRefFrom<typeof githubAuthMachine> | null>(null)
  if (!githubAuthActorRef.current && !providedGitHubAuthActor) {
    githubAuthActorRef.current = createActor(githubAuthMachine)
    githubAuthActorRef.current.start()
  }
  const githubAuthActor = providedGitHubAuthActor ?? githubAuthActorRef.current!

  // Cleanup sync actors on unmount
  useEffect(() => {
    return () => {
      if (syncActorRef.current) {
        syncActorRef.current.stop()
      }
      if (githubAuthActorRef.current) {
        githubAuthActorRef.current.stop()
      }
      cleanupUpdateStore()
    }
  }, [providedSyncActor, providedGitHubAuthActor])

  // Initialize stores when component mounts (inside React tree where RN is ready)
  useEffect(() => {
    if (skipInitialization || initializedRef.current) return
    initializedRef.current = true

    // Initialize stores - AsyncStorage is safe to use here
    // Run startup migrations before stores load so auto-sync/export uses migrated data.
    ;(async () => {
      try {
        await migratePaymentInstrumentsOnStartup()
      } catch (error) {
        console.warn("Payment instrument migration failed:", error)
      }

      await initializeSettingsStore(settingsStore)
      await initializeExpenseStore(expenseStore)
      await initializeUIStateStore(uiStateStore)
      initializeUpdateStore(updateStore)
      await runLaunchUpdateCheck(updateStore)

      const activeConfig = await getActiveProviderConfig()
      if (activeConfig && deferredProviderRef.current) {
        const provider = createProvider(activeConfig)
        deferredProviderRef.current.resolve(provider)
      }
    })()
  }, [expenseStore, settingsStore, skipInitialization, uiStateStore, updateStore])

  // Memoize the notification handler to avoid recreating on every render
  const handleSyncNotification = useCallback(
    (notification: SyncNotification) => {
      notificationStore.trigger.addNotification({
        message: notification.message,
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

  // Apply downloaded settings from background auto-sync into the settings store.
  // If the synced settings enable background SMS, request permission first.
  useEffect(() => {
    const unsubscribe = onSettingsDownloaded(async (downloaded) => {
      let settingsToApply = downloaded
      if (downloaded.backgroundSmsImportEnabled) {
        const result = await requestBackgroundSmsPermissions()
        if (!result.granted) {
          settingsToApply = { ...downloaded, backgroundSmsImportEnabled: false }
        }
      }
      settingsStore.trigger.replaceSettings({ settings: settingsToApply })
    })
    return unsubscribe
  }, [settingsStore])

  const value = useMemo(
    () => ({
      expenseStore,
      settingsStore,
      notificationStore,
      uiStateStore,
      updateStore,
      syncActor,
      githubAuthActor,
    }),
    [
      expenseStore,
      settingsStore,
      notificationStore,
      uiStateStore,
      updateStore,
      syncActor,
      githubAuthActor,
    ]
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
