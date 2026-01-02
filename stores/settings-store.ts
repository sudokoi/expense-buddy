import { createStore } from "@xstate/store"
import { Appearance } from "react-native"
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

export const settingsStore = createStore({
  context: {
    settings: DEFAULT_SETTINGS,
    isLoading: true,
    hasUnsyncedChanges: false,
    systemColorScheme: (Appearance.getColorScheme() ?? "light") as "light" | "dark",
  },

  on: {
    loadSettings: (
      context,
      event: { settings: AppSettings; hasUnsyncedChanges: boolean }
    ) => ({
      ...context,
      settings: event.settings,
      hasUnsyncedChanges: event.hasUnsyncedChanges,
      isLoading: false,
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
    const settings = await loadSettings()
    const hasChanges = await hasSettingsChanged()
    settingsStore.trigger.loadSettings({ settings, hasUnsyncedChanges: hasChanges })
  } catch (error) {
    console.warn("Failed to initialize settings store:", error)
    settingsStore.trigger.loadSettings({
      settings: DEFAULT_SETTINGS,
      hasUnsyncedChanges: false,
    })
  }
}

export type SettingsStore = typeof settingsStore
