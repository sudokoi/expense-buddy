import { clear as clearStorage, setItem } from "./storage"
import fc from "fast-check"
import {
  ThemePreference,
  AppSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  markSettingsChanged,
  clearSettingsChanged,
  hasSettingsChanged,
  getSettingsHash,
  saveSettingsHash,
  computeSettingsHash,
} from "./settings-manager"
import { PaymentMethodType } from "../types/expense"
import { DEFAULT_CATEGORIES } from "../constants/default-categories"
import type { PaymentInstrument } from "../types/payment-instrument"

const mockSecureStorage: Map<string, string> = new Map()

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) =>
    Promise.resolve(mockSecureStorage.get(key) ?? null)
  ),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStorage.set(key, value)
    return Promise.resolve()
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockSecureStorage.delete(key)
    return Promise.resolve()
  }),
}))

jest.mock("react-native", () => ({
  Platform: {
    OS: "android",
  },
}))

beforeEach(async () => {
  await clearStorage()
  mockSecureStorage.clear()
})

const themePreferenceArb = fc.constantFrom<ThemePreference>("light", "dark", "system")

const paymentMethodTypeArb = fc.constantFrom<PaymentMethodType>(
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other"
)

const optionalPaymentMethodTypeArb = fc.option(paymentMethodTypeArb, { nil: undefined })

const autoSyncTimingArb = fc.constantFrom<"on_launch" | "on_change">(
  "on_launch",
  "on_change"
)

const appSettingsArb = fc.record({
  theme: themePreferenceArb,
  syncSettings: fc.boolean(),
  defaultPaymentMethod: optionalPaymentMethodTypeArb,
  defaultCurrency: fc.constant("INR"),
  language: fc.constantFrom("system", "en-US", "en-IN", "en-GB", "hi", "ja"),
  enableMathExpressions: fc.boolean(),
  useMlOnlyForSmsImports: fc.boolean(),
  backgroundSmsImportEnabled: fc.boolean(),
  autoSyncEnabled: fc.boolean(),
  autoSyncTiming: autoSyncTimingArb,
  categories: fc.constant(DEFAULT_CATEGORIES),
  categoriesVersion: fc.constant(1),
  paymentInstruments: fc.constant<PaymentInstrument[]>([]),
  paymentInstrumentsMigrationVersion: fc.constant(0),
  updatedAt: fc
    .integer({ min: 1577836800000, max: 1924905600000 })
    .map((ms) => new Date(ms).toISOString()),
  version: fc.constant(9),
})

describe("Settings Manager Properties", () => {
  describe("Theme persistence round-trip", () => {
    it("should persist and load theme preferences correctly", async () => {
      await fc.assert(
        fc.asyncProperty(themePreferenceArb, async (theme) => {
          // already imported
          await clearStorage()

          const settings: AppSettings = {
            ...DEFAULT_SETTINGS,
            theme,
            updatedAt: new Date().toISOString(),
          }
          await saveSettings(settings)

          const loaded = await loadSettings()
          return loaded.theme === theme
        })
      )
    })

    it("should preserve theme across multiple save/load cycles", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(themePreferenceArb, { minLength: 1, maxLength: 5 }),
          async (themes) => {
            // already imported
            await clearStorage()

            for (const theme of themes) {
              const settings: AppSettings = {
                ...DEFAULT_SETTINGS,
                theme,
                updatedAt: new Date().toISOString(),
              }
              await saveSettings(settings)
            }

            const loaded = await loadSettings()
            return loaded.theme === themes[themes.length - 1]
          }
        )
      )
    })
  })

  describe("Settings serialization round-trip", () => {
    it("should preserve all settings fields through save/load cycle", async () => {
      await fc.assert(
        fc.asyncProperty(appSettingsArb, async (settings) => {
          // already imported
          await clearStorage()

          await saveSettings(settings)
          const loaded = await loadSettings()

          return (
            loaded.theme === settings.theme &&
            loaded.syncSettings === settings.syncSettings &&
            loaded.defaultPaymentMethod === settings.defaultPaymentMethod &&
            loaded.enableMathExpressions === settings.enableMathExpressions &&
            loaded.useMlOnlyForSmsImports === settings.useMlOnlyForSmsImports &&
            loaded.backgroundSmsImportEnabled === settings.backgroundSmsImportEnabled &&
            loaded.autoSyncEnabled === settings.autoSyncEnabled &&
            loaded.autoSyncTiming === settings.autoSyncTiming &&
            loaded.paymentInstrumentsMigrationVersion ===
              settings.paymentInstrumentsMigrationVersion &&
            JSON.stringify(loaded.paymentInstruments) ===
              JSON.stringify(settings.paymentInstruments) &&
            loaded.version === settings.version
          )
        })
      )
    })

    it("should produce valid JSON when serializing settings", () => {
      fc.assert(
        fc.property(appSettingsArb, (settings) => {
          const json = JSON.stringify(settings)
          const parsed = JSON.parse(json) as AppSettings
          return (
            parsed.theme === settings.theme &&
            parsed.syncSettings === settings.syncSettings &&
            parsed.defaultPaymentMethod === settings.defaultPaymentMethod &&
            parsed.enableMathExpressions === settings.enableMathExpressions &&
            parsed.useMlOnlyForSmsImports === settings.useMlOnlyForSmsImports &&
            parsed.backgroundSmsImportEnabled === settings.backgroundSmsImportEnabled &&
            parsed.autoSyncEnabled === settings.autoSyncEnabled &&
            parsed.autoSyncTiming === settings.autoSyncTiming &&
            parsed.paymentInstrumentsMigrationVersion ===
              settings.paymentInstrumentsMigrationVersion &&
            JSON.stringify(parsed.paymentInstruments) ===
              JSON.stringify(settings.paymentInstruments) &&
            parsed.updatedAt === settings.updatedAt &&
            parsed.version === settings.version
          )
        })
      )
    })
  })

  describe("Timestamp updates on modification", () => {
    it("should update timestamp when saving settings", async () => {
      await fc.assert(
        fc.asyncProperty(appSettingsArb, async (settings) => {
          // already imported
          await clearStorage()

          const beforeSave = new Date().toISOString()
          await new Promise((resolve) => setTimeout(resolve, 1))
          await saveSettings(settings)

          const loaded = await loadSettings()
          return loaded.updatedAt >= beforeSave
        })
      )
    })

    it("should have newer timestamp on subsequent saves", async () => {
      await fc.assert(
        fc.asyncProperty(appSettingsArb, appSettingsArb, async (settings1, settings2) => {
          // already imported
          await clearStorage()

          await saveSettings(settings1)
          const loaded1 = await loadSettings()
          const timestamp1 = loaded1.updatedAt

          await new Promise((resolve) => setTimeout(resolve, 2))
          await saveSettings(settings2)
          const loaded2 = await loadSettings()
          const timestamp2 = loaded2.updatedAt

          return timestamp2 >= timestamp1
        })
      )
    })
  })

  describe("Change Tracking", () => {
    it("should track settings changes correctly", async () => {
      expect(await hasSettingsChanged()).toBe(false)

      await markSettingsChanged()
      expect(await hasSettingsChanged()).toBe(true)

      await clearSettingsChanged()
      expect(await hasSettingsChanged()).toBe(false)
    })
  })

  describe("Hash Functions", () => {
    it("should compute consistent hashes for same settings", () => {
      fc.assert(
        fc.property(appSettingsArb, (settings) => {
          const hash1 = computeSettingsHash(settings)
          const hash2 = computeSettingsHash(settings)
          return hash1 === hash2
        })
      )
    })

    it("should compute different hashes for different themes", () => {
      const settings1: AppSettings = { ...DEFAULT_SETTINGS, theme: "light" }
      const settings2: AppSettings = { ...DEFAULT_SETTINGS, theme: "dark" }
      expect(computeSettingsHash(settings1)).not.toBe(computeSettingsHash(settings2))
    })

    it("should compute different hashes for different defaultPaymentMethod", () => {
      const settings1: AppSettings = { ...DEFAULT_SETTINGS, defaultPaymentMethod: "Cash" }
      const settings2: AppSettings = { ...DEFAULT_SETTINGS, defaultPaymentMethod: "UPI" }
      const settings3: AppSettings = {
        ...DEFAULT_SETTINGS,
        defaultPaymentMethod: undefined,
      }
      expect(computeSettingsHash(settings1)).not.toBe(computeSettingsHash(settings2))
      expect(computeSettingsHash(settings1)).not.toBe(computeSettingsHash(settings3))
      expect(computeSettingsHash(settings2)).not.toBe(computeSettingsHash(settings3))
    })

    it("should ignore updatedAt when computing hash", () => {
      const settings1: AppSettings = {
        ...DEFAULT_SETTINGS,
        updatedAt: "2024-01-01T00:00:00.000Z",
      }
      const settings2: AppSettings = {
        ...DEFAULT_SETTINGS,
        updatedAt: "2024-12-31T23:59:59.999Z",
      }
      expect(computeSettingsHash(settings1)).toBe(computeSettingsHash(settings2))
    })

    it("should save and retrieve hash correctly", async () => {
      const testHash = "abc123"
      await saveSettingsHash(testHash)
      const retrieved = await getSettingsHash()
      expect(retrieved).toBe(testHash)
    })
  })

  describe("Default Settings", () => {
    it("should return default settings when storage is empty", async () => {
      const loaded = await loadSettings()
      expect(loaded.theme).toBe("system")
      expect(loaded.syncSettings).toBe(true)
      expect(loaded.defaultPaymentMethod).toBeUndefined()
      expect(loaded.enableMathExpressions).toBe(false)
      expect(loaded.useMlOnlyForSmsImports).toBe(false)
      expect(loaded.backgroundSmsImportEnabled).toBe(false)
      expect(loaded.autoSyncEnabled).toBe(false)
      expect(loaded.autoSyncTiming).toBe("on_launch")
      expect(loaded.paymentInstruments).toEqual([])
      expect(loaded.paymentInstrumentsMigrationVersion).toBe(0)
      expect(loaded.language).toBe("system")
      expect(loaded.version).toBe(9)
    })
  })

  describe("Settings Sync Includes Default Payment Method", () => {
    it("should preserve defaultPaymentMethod through serialize/deserialize cycle", async () => {
      await fc.assert(
        fc.asyncProperty(appSettingsArb, async (settings) => {
          // already imported
          await clearStorage()

          await saveSettings(settings)
          const loaded = await loadSettings()
          return loaded.defaultPaymentMethod === settings.defaultPaymentMethod
        })
      )
    })

    it("should include defaultPaymentMethod in hash computation for sync change detection", () => {
      fc.assert(
        fc.property(
          optionalPaymentMethodTypeArb,
          optionalPaymentMethodTypeArb,
          (pm1, pm2) => {
            if (pm1 === pm2) return true
            const settings1: AppSettings = {
              ...DEFAULT_SETTINGS,
              defaultPaymentMethod: pm1,
            }
            const settings2: AppSettings = {
              ...DEFAULT_SETTINGS,
              defaultPaymentMethod: pm2,
            }
            return computeSettingsHash(settings1) !== computeSettingsHash(settings2)
          }
        )
      )
    })

    it("should preserve all payment method types through round-trip", async () => {
      await fc.assert(
        fc.asyncProperty(paymentMethodTypeArb, async (paymentMethod) => {
          // already imported
          await clearStorage()

          const settings: AppSettings = {
            ...DEFAULT_SETTINGS,
            defaultPaymentMethod: paymentMethod,
          }
          await saveSettings(settings)
          const loaded = await loadSettings()
          return loaded.defaultPaymentMethod === paymentMethod
        })
      )
    })
  })

  describe("Math entry setting", () => {
    it("should compute different hashes when enableMathExpressions differs", () => {
      const s1: AppSettings = { ...DEFAULT_SETTINGS, enableMathExpressions: true }
      const s2: AppSettings = { ...DEFAULT_SETTINGS, enableMathExpressions: false }
      expect(computeSettingsHash(s1)).not.toBe(computeSettingsHash(s2))
    })

    it("should compute different hashes when useMlOnlyForSmsImports differs", () => {
      const s1: AppSettings = { ...DEFAULT_SETTINGS, useMlOnlyForSmsImports: true }
      const s2: AppSettings = { ...DEFAULT_SETTINGS, useMlOnlyForSmsImports: false }
      expect(computeSettingsHash(s1)).not.toBe(computeSettingsHash(s2))
    })
  })

  describe("Missing fields use defaults", () => {
    const v2SettingsArb = fc.record({
      theme: themePreferenceArb,
      syncSettings: fc.boolean(),
      defaultPaymentMethod: optionalPaymentMethodTypeArb,
      updatedAt: fc
        .integer({ min: 1577836800000, max: 1924905600000 })
        .map((ms) => new Date(ms).toISOString()),
      version: fc.constant(2),
    })

    it("should use default autoSyncEnabled (false) when field is missing", async () => {
      await fc.assert(
        fc.asyncProperty(v2SettingsArb, async (v2Settings) => {
          // already imported
          await clearStorage()
          mockSecureStorage.clear()

          await setItem("app_settings", JSON.stringify(v2Settings))

          const loaded = await loadSettings()
          return loaded.autoSyncEnabled === false
        })
      )
    })

    it("should use default autoSyncTiming (on_launch) when field is missing", async () => {
      await fc.assert(
        fc.asyncProperty(v2SettingsArb, async (v2Settings) => {
          // already imported
          await clearStorage()
          mockSecureStorage.clear()

          await setItem("app_settings", JSON.stringify(v2Settings))

          const loaded = await loadSettings()
          return loaded.autoSyncTiming === "on_launch"
        })
      )
    })

    it("should preserve existing fields while applying defaults for missing ones", async () => {
      await fc.assert(
        fc.asyncProperty(v2SettingsArb, async (v2Settings) => {
          // already imported
          await clearStorage()
          mockSecureStorage.clear()

          await setItem("app_settings", JSON.stringify(v2Settings))

          const loaded = await loadSettings()
          return (
            loaded.theme === v2Settings.theme &&
            loaded.syncSettings === v2Settings.syncSettings &&
            loaded.defaultPaymentMethod === v2Settings.defaultPaymentMethod &&
            loaded.autoSyncEnabled === false &&
            loaded.autoSyncTiming === "on_launch" &&
            Array.isArray(loaded.paymentInstruments) &&
            loaded.paymentInstruments.length === 0 &&
            loaded.paymentInstrumentsMigrationVersion === 0 &&
            loaded.language === "system" &&
            loaded.enableMathExpressions === true &&
            loaded.useMlOnlyForSmsImports === false &&
            loaded.backgroundSmsImportEnabled === false &&
            loaded.version === 9
          )
        })
      )
    })
  })
})
