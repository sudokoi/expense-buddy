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
  hasSettingsChanged,
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

export const settingsStore = createStore({
  context: {
    settings: DEFAULT_SETTINGS,
    isLoading: true,
    hasUnsyncedChanges: false,
    systemColorScheme: (Appearance.getColorScheme() ?? "light") as "light" | "dark",
    syncConfig: null as SyncConfig | null,
    paymentMethodSectionExpanded: false,
  },

  on: {
    loadSettings: (
      context,
      event: {
        settings: AppSettings
        hasUnsyncedChanges: boolean
        syncConfig?: SyncConfig | null
        paymentMethodSectionExpanded?: boolean
      }
    ) => ({
      ...context,
      settings: event.settings,
      hasUnsyncedChanges: event.hasUnsyncedChanges,
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

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        await markSettingsChanged()
      })

      return {
        ...context,
        settings: newSettings,
        hasUnsyncedChanges: true,
      }
    },

    setSyncSettings: (context, event: { enabled: boolean }, enqueue) => {
      const newSettings = { ...context.settings, syncSettings: event.enabled }

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        await markSettingsChanged()
      })

      return {
        ...context,
        settings: newSettings,
        hasUnsyncedChanges: true,
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

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        await markSettingsChanged()
      })

      return {
        ...context,
        settings: newSettings,
        hasUnsyncedChanges: true,
      }
    },

    setAutoSyncEnabled: (context, event: { enabled: boolean }, enqueue) => {
      const newSettings = {
        ...context.settings,
        autoSyncEnabled: event.enabled,
      }

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        await markSettingsChanged()
      })

      return {
        ...context,
        settings: newSettings,
        hasUnsyncedChanges: true,
      }
    },

    setAutoSyncTiming: (context, event: { timing: AutoSyncTiming }, enqueue) => {
      const newSettings = {
        ...context.settings,
        autoSyncTiming: event.timing,
      }

      // Only mark as needing sync if auto-sync is enabled
      // When auto-sync is off, timing changes are not meaningful to sync
      const shouldMarkChanged = context.settings.autoSyncEnabled

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (shouldMarkChanged) {
          await markSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        hasUnsyncedChanges: shouldMarkChanged ? true : context.hasUnsyncedChanges,
      }
    },

    updateSettings: (context, event: { updates: Partial<AppSettings> }, enqueue) => {
      const newSettings = { ...context.settings, ...event.updates }

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        await markSettingsChanged()
      })

      return {
        ...context,
        settings: newSettings,
        hasUnsyncedChanges: true,
      }
    },

    replaceSettings: (context, event: { settings: AppSettings }, enqueue) => {
      enqueue.effect(async () => {
        await saveSettings(event.settings)
        await clearSettingsChanged()
      })

      return {
        ...context,
        settings: event.settings,
        hasUnsyncedChanges: false,
      }
    },

    clearSettingsChangeFlag: (context, _event, enqueue) => {
      enqueue.effect(async () => {
        await clearSettingsChanged()
      })

      return {
        ...context,
        hasUnsyncedChanges: false,
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

// Listen for system color scheme changes
Appearance.addChangeListener(({ colorScheme }) => {
  settingsStore.trigger.setSystemColorScheme({ scheme: colorScheme ?? "light" })
})

// Exported initialization function - call from React component tree
export async function initializeSettingsStore(): Promise<void> {
  try {
    // Load all settings in parallel
    const [settings, hasChanges, syncConfig, expandedValue] = await Promise.all([
      loadSettings(),
      hasSettingsChanged(),
      loadSyncConfigFromStorage(),
      AsyncStorage.getItem(PAYMENT_METHOD_EXPANDED_KEY),
    ])

    const paymentMethodSectionExpanded = expandedValue === "true"

    settingsStore.trigger.loadSettings({
      settings,
      hasUnsyncedChanges: hasChanges,
      syncConfig,
      paymentMethodSectionExpanded,
    })
  } catch (error) {
    console.warn("Failed to initialize settings store:", error)
    settingsStore.trigger.loadSettings({
      settings: DEFAULT_SETTINGS,
      hasUnsyncedChanges: false,
      syncConfig: null,
      paymentMethodSectionExpanded: false,
    })
  }
}

export type SettingsStore = typeof settingsStore
