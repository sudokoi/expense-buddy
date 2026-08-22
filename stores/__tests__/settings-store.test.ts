/**
 * Unit tests for Settings Store
 */

import { createStore } from "@xstate/store"
import { ThemePreference, AppSettings } from "../../services/settings-manager"
import { PaymentMethodType } from "../../types/expense"
import { DEFAULT_CATEGORIES } from "../../constants/default-categories"

const DEFAULT_SETTINGS: AppSettings = {
  theme: "system" as ThemePreference,
  syncSettings: true,
  defaultCurrency: "INR",
  language: "system",
  enableMathExpressions: true,
  useMlOnlyForSmsImports: false,
  backgroundSmsImportEnabled: false,
  autoSyncEnabled: false,
  autoSyncTiming: "on_launch",
  categories: DEFAULT_CATEGORIES,
  categoriesVersion: 1,
  paymentInstruments: [],
  paymentInstrumentsMigrationVersion: 0,
  updatedAt: new Date().toISOString(),
  version: 9,
}

// Create a fresh store for each test to avoid state pollution
function createTestSettingsStore(initialSettings: AppSettings = DEFAULT_SETTINGS) {
  return createStore({
    context: {
      settings: initialSettings,
      isLoading: false,
      hasUnsyncedChanges: false,
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

      setTheme: (context, event: { theme: ThemePreference }) => {
        const newSettings = { ...context.settings, theme: event.theme }
        return {
          ...context,
          settings: newSettings,
          hasUnsyncedChanges: true,
        }
      },

      setSyncSettings: (context, event: { enabled: boolean }) => {
        const newSettings = { ...context.settings, syncSettings: event.enabled }
        return {
          ...context,
          settings: newSettings,
          hasUnsyncedChanges: true,
        }
      },

      setDefaultPaymentMethod: (
        context,
        event: { paymentMethod: PaymentMethodType | undefined }
      ) => {
        const newSettings = {
          ...context.settings,
          defaultPaymentMethod: event.paymentMethod,
        }
        return {
          ...context,
          settings: newSettings,
          hasUnsyncedChanges: true,
        }
      },

      updateSettings: (context, event: { updates: Partial<AppSettings> }) => {
        const newSettings = { ...context.settings, ...event.updates }
        return {
          ...context,
          settings: newSettings,
          hasUnsyncedChanges: true,
        }
      },

      replaceSettings: (context, event: { settings: AppSettings }) => ({
        ...context,
        settings: event.settings,
        hasUnsyncedChanges: false,
      }),

      clearSettingsChangeFlag: (context) => ({
        ...context,
        hasUnsyncedChanges: false,
      }),
    },
  })
}

describe("Settings Store", () => {
  describe("Initial state", () => {
    it("should start with default settings", () => {
      const store = createTestSettingsStore()
      const { settings } = store.getSnapshot().context
      expect(settings.theme).toBe("system")
      expect(settings.syncSettings).toBe(true)
    })

    it("should start with isLoading=false and hasUnsyncedChanges=false", () => {
      const store = createTestSettingsStore()
      const { isLoading, hasUnsyncedChanges } = store.getSnapshot().context
      expect(isLoading).toBe(false)
      expect(hasUnsyncedChanges).toBe(false)
    })
  })

  describe("loadSettings action", () => {
    it("should load settings and set hasUnsyncedChanges", () => {
      const store = createTestSettingsStore()
      const newSettings: AppSettings = {
        theme: "dark",
        syncSettings: false,
        enableMathExpressions: true,
        useMlOnlyForSmsImports: false,
        backgroundSmsImportEnabled: false,
        autoSyncEnabled: false,
        autoSyncTiming: "on_launch",
        categories: DEFAULT_CATEGORIES,
        categoriesVersion: 1,
        paymentInstruments: [],
        paymentInstrumentsMigrationVersion: 0,
        updatedAt: new Date().toISOString(),
        version: 9,
        defaultCurrency: "INR",
        language: "system",
      }

      store.trigger.loadSettings({ settings: newSettings, hasUnsyncedChanges: true })

      const { settings, hasUnsyncedChanges, isLoading } = store.getSnapshot().context
      expect(settings.theme).toBe("dark")
      expect(settings.syncSettings).toBe(false)
      expect(hasUnsyncedChanges).toBe(true)
      expect(isLoading).toBe(false)
    })
  })

  describe("setTheme action", () => {
    it("should update theme and set hasUnsyncedChanges to true", () => {
      const store = createTestSettingsStore()

      store.trigger.setTheme({ theme: "dark" })

      const { settings, hasUnsyncedChanges } = store.getSnapshot().context
      expect(settings.theme).toBe("dark")
      expect(hasUnsyncedChanges).toBe(true)
    })

    it("should support all theme preferences", () => {
      const themes: ThemePreference[] = ["light", "dark", "system"]

      for (const theme of themes) {
        const store = createTestSettingsStore()
        store.trigger.setTheme({ theme })
        expect(store.getSnapshot().context.settings.theme).toBe(theme)
      }
    })
  })

  describe("setSyncSettings action", () => {
    it("should update syncSettings and set hasUnsyncedChanges to true", () => {
      const store = createTestSettingsStore()

      store.trigger.setSyncSettings({ enabled: false })

      const { settings, hasUnsyncedChanges } = store.getSnapshot().context
      expect(settings.syncSettings).toBe(false)
      expect(hasUnsyncedChanges).toBe(true)
    })
  })

  describe("setDefaultPaymentMethod action", () => {
    it("should set default payment method", () => {
      const store = createTestSettingsStore()

      store.trigger.setDefaultPaymentMethod({ paymentMethod: "Credit Card" })

      const { settings, hasUnsyncedChanges } = store.getSnapshot().context
      expect(settings.defaultPaymentMethod).toBe("Credit Card")
      expect(hasUnsyncedChanges).toBe(true)
    })

    it("should allow clearing default payment method", () => {
      const store = createTestSettingsStore()
      store.trigger.setDefaultPaymentMethod({ paymentMethod: "Cash" })
      store.trigger.setDefaultPaymentMethod({ paymentMethod: undefined })

      const { settings } = store.getSnapshot().context
      expect(settings.defaultPaymentMethod).toBeUndefined()
    })
  })

  describe("updateSettings action", () => {
    it("should update multiple settings at once", () => {
      const store = createTestSettingsStore()

      store.trigger.updateSettings({
        updates: { theme: "light", syncSettings: false },
      })

      const { settings, hasUnsyncedChanges } = store.getSnapshot().context
      expect(settings.theme).toBe("light")
      expect(settings.syncSettings).toBe(false)
      expect(hasUnsyncedChanges).toBe(true)
    })
  })

  describe("replaceSettings action", () => {
    it("should replace all settings and clear hasUnsyncedChanges", () => {
      const store = createTestSettingsStore()
      store.trigger.setTheme({ theme: "dark" }) // Set hasUnsyncedChanges to true

      const newSettings: AppSettings = {
        theme: "light",
        syncSettings: true,
        enableMathExpressions: false,
        useMlOnlyForSmsImports: true,
        backgroundSmsImportEnabled: false,
        autoSyncEnabled: true,
        autoSyncTiming: "on_change",
        categories: DEFAULT_CATEGORIES,
        categoriesVersion: 1,
        paymentInstruments: [],
        paymentInstrumentsMigrationVersion: 0,
        updatedAt: new Date().toISOString(),
        version: 9,
        defaultPaymentMethod: "UPI",
        defaultCurrency: "INR",
        language: "system",
      }

      store.trigger.replaceSettings({ settings: newSettings })

      const { settings, hasUnsyncedChanges } = store.getSnapshot().context
      expect(settings).toEqual(newSettings)
      expect(hasUnsyncedChanges).toBe(false)
    })
  })

  describe("clearSettingsChangeFlag action", () => {
    it("should clear hasUnsyncedChanges flag", () => {
      const store = createTestSettingsStore()
      store.trigger.setTheme({ theme: "dark" }) // Set hasUnsyncedChanges to true

      store.trigger.clearSettingsChangeFlag()

      expect(store.getSnapshot().context.hasUnsyncedChanges).toBe(false)
    })
  })
})
