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
import { persistExpensesSnapshot } from "../services/expense-storage"
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
import { githubAuthMachine } from "../services/github-auth-machine"
import { migratePaymentInstrumentsOnStartup } from "../services/payment-instruments-migration"
import { requestBackgroundSmsPermissions } from "../services/background-sms/background-sms-permissions"
import { logAsync } from "../services/logger"
import { syncOrchestrator } from "../services/sync/sync-engine"
import { promptConflictResolution } from "../services/sync/conflict-prompt"

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
  githubAuthActor: providedGitHubAuthActor,
  skipInitialization = false,
}) => {
  const initializedRef = useRef(false)

  // Create GitHub auth actor once on mount
  const githubAuthActorRef = useRef<ActorRefFrom<typeof githubAuthMachine> | null>(null)
  if (!githubAuthActorRef.current && !providedGitHubAuthActor) {
    githubAuthActorRef.current = createActor(githubAuthMachine)
    githubAuthActorRef.current.start()
    logAsync("INFO", "INIT", "GITHUB_AUTH_ACTOR_CREATED")
  }
  const githubAuthActor = providedGitHubAuthActor ?? githubAuthActorRef.current!
  const providerStore = providedProviderStore ?? defaultProviderStore

  // Cleanup actors on unmount
  useEffect(() => {
    return () => {
      if (githubAuthActorRef.current) {
        githubAuthActorRef.current.stop()
      }
      cleanupUpdateStore()
    }
  }, [providedGitHubAuthActor])

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
      // Local expenses are now loaded: release any first reconciliation that was
      // deferred because it would otherwise have merged against an empty set.
      syncOrchestrator.notifyLocalDataReady()
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

      // Provider binding for sync is owned by the SyncOrchestrator: the effect
      // below calls `syncOrchestrator.rebindProvider()` on mount and on every
      // active-provider change, which fires the activation-triggered first
      // reconciliation. No separate provider resolution is needed here.

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
      isLocalDataReady: () => !expenseStore.getSnapshot().context.isLoading,
      // Write-through: persist to AsyncStorage BEFORE updating in-memory state.
      // Merged data survives app restart even if the replaceExpenses effect
      // hasn't run yet.
      onMerged: async (expenses) => {
        await persistExpensesSnapshot(expenses)
        expenseStore.trigger.replaceExpenses({ expenses })
      },
      onSettingsDownloaded: (settings) => emitSettingsDownloaded(settings),
      onNotify: (notification) =>
        expenseStore.trigger.setSyncNotification({ notification }),
      onDirtyDaysCleared: () => expenseStore.trigger.clearDirtyDaysState(),
      onReconciled: (providerId) =>
        providerStore.trigger.markReconciled({ id: providerId }),
      conflictResolver: promptConflictResolution,
      onAuthError: ({ shouldSignOut }) => {
        if (shouldSignOut) {
          settingsStore.trigger.clearSyncConfig()
        }
      },
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
  }, [expenseStore, providerStore, settingsStore, skipInitialization])

  const value = useMemo(
    () => ({
      expenseStore,
      settingsStore,
      notificationStore,
      uiStateStore,
      updateStore,
      providerStore,
      filterStore,
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
