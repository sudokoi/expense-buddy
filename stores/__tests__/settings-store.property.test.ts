/**
 * Property-based tests for Settings Store
 *
 * Property 4: Settings Update Persistence
 * For any valid theme preference (light, dark, system), setting the theme SHALL result
 * in the settings store containing that theme value and hasUnsyncedChanges being true.
 *
 * Property 5: Settings Replacement Clears Change Flag
 * For any valid AppSettings object, replacing settings SHALL result in the settings store
 * containing those exact settings and hasUnsyncedChanges being false.
 *
 * Property 6: Effective Theme Computation
 * For any combination of theme preference and system color scheme:
 * - If theme is 'light', effectiveTheme SHALL be 'light'
 * - If theme is 'dark', effectiveTheme SHALL be 'dark'
 * - If theme is 'system', effectiveTheme SHALL equal the system color scheme
 */

import fc from "fast-check"
import { createStore } from "@xstate/store"
import {
  ThemePreference,
  AppSettings,
  AutoSyncTiming,
} from "../../services/settings-manager"
import { PaymentMethodType } from "../../types/expense"

const DEFAULT_SETTINGS: AppSettings = {
  theme: "system" as ThemePreference,
  syncSettings: true,
  autoSyncEnabled: false,
  autoSyncTiming: "on_launch",
  updatedAt: new Date().toISOString(),
  version: 3,
}

// Create a fresh store for each test
function createTestSettingsStore(initialSettings: AppSettings = DEFAULT_SETTINGS) {
  return createStore({
    context: {
      settings: initialSettings,
      isLoading: false,
      hasUnsyncedChanges: false,
      systemColorScheme: "light" as "light" | "dark",
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

// Computed selector for effective theme
type SettingsContext = {
  settings: AppSettings
  systemColorScheme: "light" | "dark"
}

const selectEffectiveTheme = (context: SettingsContext): "light" | "dark" => {
  if (context.settings.theme === "system") {
    return context.systemColorScheme
  }
  return context.settings.theme
}

// Arbitrary generators
const themePreferenceArb = fc.constantFrom<ThemePreference>("light", "dark", "system")
const systemColorSchemeArb = fc.constantFrom<"light" | "dark">("light", "dark")
const paymentMethodArb = fc.constantFrom<PaymentMethodType>(
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other"
)
const optionalPaymentMethodArb = fc.option(paymentMethodArb, { nil: undefined })

const autoSyncTimingArb = fc.constantFrom<AutoSyncTiming>("on_launch", "on_change")

const appSettingsArb: fc.Arbitrary<AppSettings> = fc.record({
  theme: themePreferenceArb,
  syncSettings: fc.boolean(),
  autoSyncEnabled: fc.boolean(),
  autoSyncTiming: autoSyncTimingArb,
  updatedAt: fc
    .integer({ min: 1577836800000, max: 1924905600000 })
    .map((ms) => new Date(ms).toISOString()),
  version: fc.integer({ min: 1, max: 10 }),
  defaultPaymentMethod: optionalPaymentMethodArb,
})

describe("Settings Store Properties", () => {
  /**
   * Property 4: Settings Update Persistence
   */
  describe("Property 4: Settings Update Persistence", () => {
    it("setTheme SHALL update theme and set hasUnsyncedChanges to true", () => {
      fc.assert(
        fc.property(themePreferenceArb, (theme) => {
          const store = createTestSettingsStore()

          store.trigger.setTheme({ theme })

          const { settings, hasUnsyncedChanges } = store.getSnapshot().context
          return settings.theme === theme && hasUnsyncedChanges === true
        }),
        { numRuns: 100 }
      )
    })

    it("setSyncSettings SHALL update syncSettings and set hasUnsyncedChanges to true", () => {
      fc.assert(
        fc.property(fc.boolean(), (enabled) => {
          const store = createTestSettingsStore()

          store.trigger.setSyncSettings({ enabled })

          const { settings, hasUnsyncedChanges } = store.getSnapshot().context
          return settings.syncSettings === enabled && hasUnsyncedChanges === true
        }),
        { numRuns: 100 }
      )
    })

    it("setDefaultPaymentMethod SHALL update payment method and set hasUnsyncedChanges to true", () => {
      fc.assert(
        fc.property(optionalPaymentMethodArb, (paymentMethod) => {
          const store = createTestSettingsStore()

          store.trigger.setDefaultPaymentMethod({ paymentMethod })

          const { settings, hasUnsyncedChanges } = store.getSnapshot().context
          return (
            settings.defaultPaymentMethod === paymentMethod && hasUnsyncedChanges === true
          )
        }),
        { numRuns: 100 }
      )
    })

    it("updateSettings SHALL apply partial updates and set hasUnsyncedChanges to true", () => {
      fc.assert(
        fc.property(
          themePreferenceArb,
          fc.boolean(),
          optionalPaymentMethodArb,
          (theme, syncSettings, defaultPaymentMethod) => {
            const store = createTestSettingsStore()

            store.trigger.updateSettings({
              updates: { theme, syncSettings, defaultPaymentMethod },
            })

            const { settings, hasUnsyncedChanges } = store.getSnapshot().context
            return (
              settings.theme === theme &&
              settings.syncSettings === syncSettings &&
              settings.defaultPaymentMethod === defaultPaymentMethod &&
              hasUnsyncedChanges === true
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 5: Settings Replacement Clears Change Flag
   */
  describe("Property 5: Settings Replacement Clears Change Flag", () => {
    it("replaceSettings SHALL set exact settings and clear hasUnsyncedChanges", () => {
      fc.assert(
        fc.property(appSettingsArb, (newSettings) => {
          const store = createTestSettingsStore()
          // First make a change to set hasUnsyncedChanges to true
          store.trigger.setTheme({ theme: "dark" })

          store.trigger.replaceSettings({ settings: newSettings })

          const { settings, hasUnsyncedChanges } = store.getSnapshot().context
          return (
            settings.theme === newSettings.theme &&
            settings.syncSettings === newSettings.syncSettings &&
            settings.version === newSettings.version &&
            settings.defaultPaymentMethod === newSettings.defaultPaymentMethod &&
            hasUnsyncedChanges === false
          )
        }),
        { numRuns: 100 }
      )
    })

    it("clearSettingsChangeFlag SHALL clear hasUnsyncedChanges without changing settings", () => {
      fc.assert(
        fc.property(appSettingsArb, themePreferenceArb, (initialSettings, newTheme) => {
          const store = createTestSettingsStore(initialSettings)
          store.trigger.setTheme({ theme: newTheme })

          const settingsBefore = { ...store.getSnapshot().context.settings }

          store.trigger.clearSettingsChangeFlag()

          const { settings, hasUnsyncedChanges } = store.getSnapshot().context
          return (
            settings.theme === settingsBefore.theme &&
            settings.syncSettings === settingsBefore.syncSettings &&
            hasUnsyncedChanges === false
          )
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 6: Effective Theme Computation
   */
  describe("Property 6: Effective Theme Computation", () => {
    it("effectiveTheme SHALL be light when theme preference is light", () => {
      fc.assert(
        fc.property(systemColorSchemeArb, (systemScheme) => {
          const store = createTestSettingsStore()
          store.trigger.setTheme({ theme: "light" })
          store.trigger.setSystemColorScheme({ scheme: systemScheme })

          const effectiveTheme = selectEffectiveTheme(store.getSnapshot().context)
          return effectiveTheme === "light"
        }),
        { numRuns: 100 }
      )
    })

    it("effectiveTheme SHALL be dark when theme preference is dark", () => {
      fc.assert(
        fc.property(systemColorSchemeArb, (systemScheme) => {
          const store = createTestSettingsStore()
          store.trigger.setTheme({ theme: "dark" })
          store.trigger.setSystemColorScheme({ scheme: systemScheme })

          const effectiveTheme = selectEffectiveTheme(store.getSnapshot().context)
          return effectiveTheme === "dark"
        }),
        { numRuns: 100 }
      )
    })

    it("effectiveTheme SHALL equal system color scheme when theme preference is system", () => {
      fc.assert(
        fc.property(systemColorSchemeArb, (systemScheme) => {
          const store = createTestSettingsStore()
          store.trigger.setTheme({ theme: "system" })
          store.trigger.setSystemColorScheme({ scheme: systemScheme })

          const effectiveTheme = selectEffectiveTheme(store.getSnapshot().context)
          return effectiveTheme === systemScheme
        }),
        { numRuns: 100 }
      )
    })

    it("effectiveTheme SHALL always be light or dark, never system", () => {
      fc.assert(
        fc.property(themePreferenceArb, systemColorSchemeArb, (theme, systemScheme) => {
          const store = createTestSettingsStore()
          store.trigger.setTheme({ theme })
          store.trigger.setSystemColorScheme({ scheme: systemScheme })

          const effectiveTheme = selectEffectiveTheme(store.getSnapshot().context)
          return effectiveTheme === "light" || effectiveTheme === "dark"
        }),
        { numRuns: 100 }
      )
    })
  })
})
