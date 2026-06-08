import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react"
import { Platform } from "react-native"
import { createActor, ActorRefFrom } from "xstate"
import {
  expenseStore as defaultExpenseStore,
  ExpenseStore,
  initializeExpenseStore,
  emitSettingsDownloaded,
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
import {
  providerStore as defaultProviderStore,
  initializeProviderStore,
  ProviderStore,
} from "./provider-store"
import { filterStore as defaultFilterStore, initializeFilterStore } from "./filter-store"
import { syncMachine } from "../services/sync-machine"
import { githubAuthMachine } from "../services/github-auth-machine"
import { migratePaymentInstrumentsOnStartup } from "../services/payment-instruments-migration"
import { requestBackgroundSmsPermissions } from "../services/background-sms/background-sms-permissions"
import { DeferredProvider } from "../services/sync/deferred-provider"
import { logAsync } from "../services/logger"
import { createProvider } from "../services/sync/provider-registry"
import { getActiveProviderConfig } from "../services/sync-config"
import { syncOrchestrator } from "../services/sync/sync-engine"

// Register provider factories at import time
import "../services/sync"

interface StoreContextValue {
  expenseStore: ExpenseStore
  settingsStore: SettingsStore
  notificationStore: NotificationStore
  uiStateStore: UIStateStore
  updateStore: UpdateStore
  providerStore: ProviderStore
  filterStore: typeof defaultFilterStore
  syncActor: ActorRefFrom<typeof syncMachine>
  githubAuthActor: ActorRefFrom<typeof githubAuthMachine>
}

const StoreContext = createContext<StoreContextValue | null>(null)

interface StoreProviderProps {
  children: React.ReactNode
  expenseStore?: ExpenseStore
  settingsStore?: SettingsStore
  notificationStore?: NotificationStore
  uiStateStore?: UIStateStore
  updateStore?: UpdateStore
  providerStore?: ProviderStore
  filterStore?: typeof defaultFilterStore
  syncActor?: ActorRefFrom<typeof syncMachine>
  githubAuthActor?: ActorRefFrom<typeof githubAuthMachine>
  skipInitialization?: boolean
}

export const StoreProvider: React.FC<StoreProviderProps> = ({
  children,
  expenseStore = defaultExpenseStore,
  settingsStore = defaultSettingsStore,
  notificationStore = defaultNotificationStore,
  uiStateStore = defaultUIStateStore,
  updateStore = defaultUpdateStore,
  providerStore: providedProviderStore,
  filterStore = defaultFilterStore,
  syncActor: providedSyncActor,
  githubAuthActor: providedGitHubAuthActor,
  skipInitialization = false,
}) => {
  const initializedRef = useRef(false)
  const deferredProviderRef = useRef<DeferredProvider | null>(null)

  // Create sync actor once on mount (using ref to avoid recreating)
  const syncActorRef = useRef<ActorRefFrom<typeof syncMachine> | null>(null)
  if (!syncActorRef.current && !providedSyncActor) {
    const deferredProvider = new DeferredProvider(async () => {
      const snapshot = providerStore.getSnapshot()
      const activeConfig = snapshot.context.activeProviderId
        ? snapshot.context.providers.find(
            (p) => p.id === snapshot.context.activeProviderId
          )
        : null
      if (!activeConfig) {
        throw new Error("No active provider config found")
      }
      return createProvider(activeConfig)
    })
    deferredProviderRef.current = deferredProvider
    syncActorRef.current = createActor(syncMachine, {
      input: { provider: deferredProvider },
    })
    syncActorRef.current.start()
    logAsync("INFO", "INIT", "SYNC_ACTOR_CREATED")
  }
  const syncActor = providedSyncActor ?? syncActorRef.current!

  // Create GitHub auth actor once on mount
  const githubAuthActorRef = useRef<ActorRefFrom<typeof githubAuthMachine> | null>(null)
  if (!githubAuthActorRef.current && !providedGitHubAuthActor) {
    githubAuthActorRef.current = createActor(githubAuthMachine)
    githubAuthActorRef.current.start()
    logAsync("INFO", "INIT", "GITHUB_AUTH_ACTOR_CREATED")
  }
  const githubAuthActor = providedGitHubAuthActor ?? githubAuthActorRef.current!
  const providerStore = providedProviderStore ?? defaultProviderStore

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
      logAsync("INFO", "INIT", "INITIALIZATION_STARTED")

      try {
        await migratePaymentInstrumentsOnStartup()
        logAsync("INFO", "INIT", "PAYMENT_INSTRUMENT_MIGRATION_SUCCESS")
      } catch (error) {
        console.warn("Payment instrument migration failed:", error)
        logAsync("WARN", "INIT", `PAYMENT_INSTRUMENT_MIGRATION_FAILED error=${error}`)
      }

      logAsync("INFO", "INIT", "SETTINGS_STORE_INIT_START")
      await initializeSettingsStore(settingsStore)
      logAsync("INFO", "INIT", "SETTINGS_STORE_INIT_DONE")

      logAsync("INFO", "INIT", "EXPENSE_STORE_INIT_START")
      await initializeExpenseStore(expenseStore)
      logAsync("INFO", "INIT", "EXPENSE_STORE_INIT_DONE")

      logAsync("INFO", "INIT", "UI_STATE_STORE_INIT_START")
      await initializeUIStateStore(uiStateStore)
      logAsync("INFO", "INIT", "UI_STATE_STORE_INIT_DONE")

      logAsync("INFO", "INIT", "PROVIDER_STORE_INIT_START")
      await initializeProviderStore(providerStore)
      logAsync("INFO", "INIT", "PROVIDER_STORE_INIT_DONE")

      logAsync("INFO", "INIT", "FILTER_STORE_INIT_START")
      await initializeFilterStore()
      logAsync("INFO", "INIT", "FILTER_STORE_INIT_DONE")

      if (Platform.OS === "android") {
        logAsync("INFO", "INIT", "UPDATE_STORE_INIT_START")
        initializeUpdateStore(updateStore)
        await runLaunchUpdateCheck(updateStore)
        logAsync("INFO", "INIT", "UPDATE_STORE_INIT_DONE")
      }

      try {
        const activeConfig = await getActiveProviderConfig()
        if (activeConfig && deferredProviderRef.current) {
          const provider = createProvider(activeConfig)
          deferredProviderRef.current.resolve(provider)
          logAsync(
            "INFO",
            "INIT",
            `PROVIDER_RESOLVED kind=${activeConfig.kind} id=${activeConfig.id}`
          )
        } else {
          logAsync("INFO", "INIT", "PROVIDER_RESOLUTION_SKIPPED noActiveConfig")
        }
      } catch (error) {
        logAsync("WARN", "INIT", `PROVIDER_RESOLUTION_FAILED error=${error}`)
        console.warn("Failed to resolve sync provider:", error)
      }

      if (deferredProviderRef.current && !deferredProviderRef.current.isResolved) {
        setTimeout(() => {
          if (deferredProviderRef.current && !deferredProviderRef.current.isResolved) {
            logAsync("WARN", "INIT", "PROVIDER_TIMEOUT_UNRESOLVED")
            console.warn(
              "Sync provider not resolved within timeout; sync will retry on next attempt"
            )
          }
        }, 30000)
      }

      logAsync("INFO", "INIT", "INITIALIZATION_COMPLETE")
    })()
  }, [
    expenseStore,
    settingsStore,
    skipInitialization,
    uiStateStore,
    updateStore,
    providerStore,
  ])

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

  // Wire the SyncOrchestrator to the stores and route provider activation through
  // it. The orchestrator is a module-level singleton constructed with default
  // service deps; here we inject the store-facing callbacks (so merged
  // results/settings/notifications route back into the stores) and rebind it
  // whenever the active provider changes (add/switch, and the initial load),
  // which fires the activation-triggered first reconciliation.
  useEffect(() => {
    if (skipInitialization) return

    syncOrchestrator.setStoreBindings({
      getLocalExpenses: () => expenseStore.getSnapshot().context.expenses,
      onMerged: (expenses) => expenseStore.trigger.replaceExpenses({ expenses }),
      onSettingsDownloaded: (settings) => emitSettingsDownloaded(settings),
      onNotify: (notification) =>
        expenseStore.trigger.setSyncNotification({ notification }),
    })

    let lastActiveProviderId = providerStore.getSnapshot().context.activeProviderId
    if (lastActiveProviderId) {
      // A provider is already active on mount (e.g. fast store init): rebind so
      // the activation-triggered first reconciliation runs on launch.
      void syncOrchestrator.rebindProvider()
    }

    const subscription = providerStore.subscribe((snapshot) => {
      const nextActiveProviderId = snapshot.context.activeProviderId
      if (nextActiveProviderId === lastActiveProviderId) return
      lastActiveProviderId = nextActiveProviderId
      logAsync(
        "INFO",
        "INIT",
        `PROVIDER_ACTIVATION_CHANGED activeProviderId=${nextActiveProviderId ?? "null"}`
      )
      void syncOrchestrator.rebindProvider()
    })

    return () => subscription.unsubscribe()
  }, [expenseStore, providerStore, skipInitialization])

  const value = useMemo(
    () => ({
      expenseStore,
      settingsStore,
      notificationStore,
      uiStateStore,
      updateStore,
      providerStore,
      filterStore,
      syncActor,
      githubAuthActor,
    }),
    [
      expenseStore,
      settingsStore,
      notificationStore,
      uiStateStore,
      updateStore,
      providerStore,
      filterStore,
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
