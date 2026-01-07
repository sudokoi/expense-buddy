import { createStore } from "@xstate/store"
import { Appearance } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  AppSettings,
  ThemePreference,
  AutoSyncTiming,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  markSettingsChanged,
  clearSettingsChanged,
  computeSettingsHash,
  getSettingsHash,
  saveSettingsHash,
} from "../services/settings-manager"
import { PaymentMethodType } from "../types/expense"
import {
  SyncConfig,
  saveSyncConfig as saveSyncConfigToStorage,
  clearSyncConfig as clearSyncConfigFromStorage,
  loadSyncConfig as loadSyncConfigFromStorage,
} from "../services/sync-manager"

// AsyncStorage key for payment method section expanded state
const PAYMENT_METHOD_EXPANDED_KEY = "payment_method_section_expanded"

/**
 * Settings sync state enum
 * - "synced": Current settings match the last synced version
 * - "modified": Local changes pending sync
 */
export type SettingsSyncState = "synced" | "modified"

/**
 * Compute sync state by comparing current settings hash against synced hash
 */
function computeSyncState(
  currentSettings: AppSettings,
  syncedHash: string | null
): SettingsSyncState {
  const currentHash = computeSettingsHash(currentSettings)
  if (!syncedHash) {
    // No previous sync - check if settings differ from defaults
    const defaultHash = computeSettingsHash(DEFAULT_SETTINGS)
    return currentHash === defaultHash ? "synced" : "modified"
  }
  return currentHash === syncedHash ? "synced" : "modified"
}

export const settingsStore = createStore({
  context: {
    settings: DEFAULT_SETTINGS,
    isLoading: true,
    settingsSyncState: "synced" as SettingsSyncState,
    syncedSettingsHash: null as string | null,
    systemColorScheme: (Appearance.getColorScheme() ?? "light") as "light" | "dark",
    syncConfig: null as SyncConfig | null,
    paymentMethodSectionExpanded: false,
  },

  on: {
    loadSettings: (
      context,
      event: {
        settings: AppSettings
        settingsSyncState: SettingsSyncState
        syncedSettingsHash: string | null
        syncConfig?: SyncConfig | null
        paymentMethodSectionExpanded?: boolean
      }
    ) => ({
      ...context,
      settings: event.settings,
      settingsSyncState: event.settingsSyncState,
      syncedSettingsHash: event.syncedSettingsHash,
      isLoading: false,
      syncConfig: event.syncConfig ?? context.syncConfig,
      paymentMethodSectionExpanded:
        event.paymentMethodSectionExpanded ?? context.paymentMethodSectionExpanded,
    }),

    setSystemColorScheme: (context, event: { scheme: "light" | "dark" }) => ({
      ...context,
      systemColorScheme: event.scheme,
    }),

    setTheme: (context, event: { theme: ThemePreference }, enqueue) => {
      const newSettings = { ...context.settings, theme: event.theme }
      const newSyncState = computeSyncState(newSettings, context.syncedSettingsHash)

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (newSyncState === "modified") {
          await markSettingsChanged()
        } else {
          await clearSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },

    setSyncSettings: (context, event: { enabled: boolean }, enqueue) => {
      const newSettings = { ...context.settings, syncSettings: event.enabled }
      const newSyncState = computeSyncState(newSettings, context.syncedSettingsHash)

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (newSyncState === "modified") {
          await markSettingsChanged()
        } else {
          await clearSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },

    setDefaultPaymentMethod: (
      context,
      event: { paymentMethod: PaymentMethodType | undefined },
      enqueue
    ) => {
      const newSettings = {
        ...context.settings,
        defaultPaymentMethod: event.paymentMethod,
      }
      const newSyncState = computeSyncState(newSettings, context.syncedSettingsHash)

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (newSyncState === "modified") {
          await markSettingsChanged()
        } else {
          await clearSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },

    setAutoSyncEnabled: (context, event: { enabled: boolean }, enqueue) => {
      const newSettings = {
        ...context.settings,
        autoSyncEnabled: event.enabled,
      }
      const newSyncState = computeSyncState(newSettings, context.syncedSettingsHash)

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (newSyncState === "modified") {
          await markSettingsChanged()
        } else {
          await clearSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },

    setAutoSyncTiming: (context, event: { timing: AutoSyncTiming }, enqueue) => {
      const newSettings = {
        ...context.settings,
        autoSyncTiming: event.timing,
      }

      // Only mark as needing sync if auto-sync is enabled
      // When auto-sync is off, timing changes are not meaningful to sync
      const shouldTrackChange = context.settings.autoSyncEnabled
      const newSyncState = shouldTrackChange
        ? computeSyncState(newSettings, context.syncedSettingsHash)
        : context.settingsSyncState

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (shouldTrackChange) {
          if (newSyncState === "modified") {
            await markSettingsChanged()
          } else {
            await clearSettingsChanged()
          }
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },

    updateSettings: (context, event: { updates: Partial<AppSettings> }, enqueue) => {
      const newSettings = { ...context.settings, ...event.updates }
      const newSyncState = computeSyncState(newSettings, context.syncedSettingsHash)

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (newSyncState === "modified") {
          await markSettingsChanged()
        } else {
          await clearSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },

    replaceSettings: (
      context,
      event: { settings: AppSettings; syncedSettingsHash?: string },
      enqueue
    ) => {
      const newHash = event.syncedSettingsHash ?? computeSettingsHash(event.settings)

      enqueue.effect(async () => {
        await saveSettings(event.settings)
        await saveSettingsHash(newHash)
        await clearSettingsChanged()
      })

      return {
        ...context,
        settings: event.settings,
        settingsSyncState: "synced" as SettingsSyncState,
        syncedSettingsHash: newHash,
      }
    },

    clearSettingsChangeFlag: (context, _event, enqueue) => {
      const currentHash = computeSettingsHash(context.settings)

      enqueue.effect(async () => {
        await saveSettingsHash(currentHash)
        await clearSettingsChanged()
      })

      return {
        ...context,
        settingsSyncState: "synced" as SettingsSyncState,
        syncedSettingsHash: currentHash,
      }
    },

    // Called after successful sync to update the synced hash
    syncSettingsSuccess: (context, event: { settingsHash: string }, enqueue) => {
      enqueue.effect(async () => {
        await saveSettingsHash(event.settingsHash)
        await clearSettingsChanged()
      })

      return {
        ...context,
        settingsSyncState: "synced" as SettingsSyncState,
        syncedSettingsHash: event.settingsHash,
      }
    },

    // Sync config management actions
    loadSyncConfig: (context, event: { config: SyncConfig | null }) => ({
      ...context,
      syncConfig: event.config,
    }),

    saveSyncConfig: (context, event: { config: SyncConfig }, enqueue) => {
      enqueue.effect(async () => {
        await saveSyncConfigToStorage(event.config)
      })

      return {
        ...context,
        syncConfig: event.config,
      }
    },

    clearSyncConfig: (context, _event, enqueue) => {
      enqueue.effect(async () => {
        await clearSyncConfigFromStorage()
      })

      return {
        ...context,
        syncConfig: null,
      }
    },

    // Payment method section expanded state
    setPaymentMethodExpanded: (context, event: { expanded: boolean }, enqueue) => {
      enqueue.effect(async () => {
        await AsyncStorage.setItem(
          PAYMENT_METHOD_EXPANDED_KEY,
          event.expanded ? "true" : "false"
        )
      })

      return {
        ...context,
        paymentMethodSectionExpanded: event.expanded,
      }
    },
  },
})

// Computed selector for effective theme
type SettingsContext = typeof settingsStore extends {
  getSnapshot: () => { context: infer C }
}
  ? C
  : never

export const selectEffectiveTheme = (context: SettingsContext): "light" | "dark" => {
  if (context.settings.theme === "system") {
    return context.systemColorScheme
  }
  return context.settings.theme
}

/**
 * Selector to derive hasUnsyncedChanges boolean from sync state
 * For backward compatibility with existing code
 */
export const selectHasUnsyncedChanges = (context: SettingsContext): boolean => {
  return context.settingsSyncState === "modified"
}

// Listen for system color scheme changes
Appearance.addChangeListener(({ colorScheme }) => {
  settingsStore.trigger.setSystemColorScheme({ scheme: colorScheme ?? "light" })
})

// Exported initialization function - call from React component tree
export async function initializeSettingsStore(): Promise<void> {
  try {
    // Load all settings in parallel
    const [settings, syncedSettingsHash, syncConfig, expandedValue] = await Promise.all([
      loadSettings(),
      getSettingsHash(),
      loadSyncConfigFromStorage(),
      AsyncStorage.getItem(PAYMENT_METHOD_EXPANDED_KEY),
    ])

    const paymentMethodSectionExpanded = expandedValue === "true"

    // Compute initial sync state by comparing current settings against synced hash
    const settingsSyncState = computeSyncState(settings, syncedSettingsHash)

    settingsStore.trigger.loadSettings({
      settings,
      settingsSyncState,
      syncedSettingsHash,
      syncConfig,
      paymentMethodSectionExpanded,
    })
  } catch (error) {
    console.warn("Failed to initialize settings store:", error)
    settingsStore.trigger.loadSettings({
      settings: DEFAULT_SETTINGS,
      settingsSyncState: "synced",
      syncedSettingsHash: null,
      syncConfig: null,
      paymentMethodSectionExpanded: false,
    })
  }
}

export type SettingsStore = typeof settingsStore
