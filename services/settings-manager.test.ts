/**
 * Property-based tests for Settings Manager
 *
 * Tests the settings persistence, serialization, and change tracking functionality.
 */

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

// Mock AsyncStorage for testing
const mockStorage: Map<string, string> = new Map()
const mockSecureStorage: Map<string, string> = new Map()

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value)
    return Promise.resolve()
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key)
    return Promise.resolve()
  }),
}))

// Mock expo-secure-store for testing
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

// Mock react-native Platform
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios", // Use non-web platform to test secure storage
  },
}))

// Clear mock storage before each test
beforeEach(() => {
  mockStorage.clear()
  mockSecureStorage.clear()
})

// Arbitrary generators for settings types
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
  autoSyncEnabled: fc.boolean(),
  autoSyncTiming: autoSyncTimingArb,
  categories: fc.constant(DEFAULT_CATEGORIES),
  categoriesVersion: fc.constant(1),
  paymentInstruments: fc.constant<PaymentInstrument[]>([]),
  paymentInstrumentsMigrationVersion: fc.constant(0),
  updatedAt: fc
    .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31 in ms
    .map((ms) => new Date(ms).toISOString()),
  version: fc.constant(5), // Always use latest version to avoid migration in tests
})

describe("Settings Manager Properties", () => {
  /**
   * For any valid theme preference (light, dark, system), saving it to storage
   * and then loading it back SHALL produce the same theme preference.
   */
  describe("Theme persistence round-trip", () => {
    it("should persist and load theme preferences correctly", async () => {
      await fc.assert(
        fc.asyncProperty(themePreferenceArb, async (theme) => {
          // Clear storage before each iteration
          mockStorage.clear()

          // Create settings with the theme
          const settings: AppSettings = {
            ...DEFAULT_SETTINGS,
            theme,
            updatedAt: new Date().toISOString(),
          }

          // Save settings
          await saveSettings(settings)

          // Load settings back
          const loaded = await loadSettings()

          // Theme should match
          return loaded.theme === theme
        }),
        { numRuns: 100 }
      )
    })

    it("should preserve theme across multiple save/load cycles", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(themePreferenceArb, { minLength: 1, maxLength: 5 }),
          async (themes) => {
            mockStorage.clear()

            // Save and load each theme in sequence
            for (const theme of themes) {
              const settings: AppSettings = {
                ...DEFAULT_SETTINGS,
                theme,
                updatedAt: new Date().toISOString(),
              }
              await saveSettings(settings)
            }

            // Final loaded theme should match the last saved theme
            const loaded = await loadSettings()
            return loaded.theme === themes[themes.length - 1]
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * For any valid AppSettings object, serializing to JSON and deserializing
   * SHALL produce an equivalent object with all fields preserved.
   */
  describe("Settings serialization round-trip", () => {
    it("should preserve all settings fields through save/load cycle", async () => {
      await fc.assert(
        fc.asyncProperty(appSettingsArb, async (settings) => {
          mockStorage.clear()

          // Save settings
          await saveSettings(settings)

          // Load settings back
          const loaded = await loadSettings()

          // All fields except updatedAt should match (updatedAt is updated on save)
          return (
            loaded.theme === settings.theme &&
            loaded.syncSettings === settings.syncSettings &&
            loaded.defaultPaymentMethod === settings.defaultPaymentMethod &&
            loaded.autoSyncEnabled === settings.autoSyncEnabled &&
            loaded.autoSyncTiming === settings.autoSyncTiming &&
            loaded.paymentInstrumentsMigrationVersion ===
              settings.paymentInstrumentsMigrationVersion &&
            JSON.stringify(loaded.paymentInstruments) ===
              JSON.stringify(settings.paymentInstruments) &&
            loaded.version === settings.version
          )
        }),
        { numRuns: 100 }
      )
    })

    it("should produce valid JSON when serializing settings", () => {
      fc.assert(
        fc.property(appSettingsArb, (settings) => {
          // Serialize to JSON
          const json = JSON.stringify(settings)

          // Parse back
          const parsed = JSON.parse(json) as AppSettings

          // All fields should match
          return (
            parsed.theme === settings.theme &&
            parsed.syncSettings === settings.syncSettings &&
            parsed.defaultPaymentMethod === settings.defaultPaymentMethod &&
            parsed.autoSyncEnabled === settings.autoSyncEnabled &&
            parsed.autoSyncTiming === settings.autoSyncTiming &&
            parsed.paymentInstrumentsMigrationVersion ===
              settings.paymentInstrumentsMigrationVersion &&
            JSON.stringify(parsed.paymentInstruments) ===
              JSON.stringify(settings.paymentInstruments) &&
            parsed.updatedAt === settings.updatedAt &&
            parsed.version === settings.version
          )
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * For any settings modification, the updatedAt timestamp SHALL be updated
   * to a value greater than or equal to the previous timestamp.
   */
  describe("Timestamp updates on modification", () => {
    it("should update timestamp when saving settings", async () => {
      await fc.assert(
        fc.asyncProperty(appSettingsArb, async (settings) => {
          mockStorage.clear()

          // Record time before save
          const beforeSave = new Date().toISOString()

          // Small delay to ensure timestamp difference
          await new Promise((resolve) => setTimeout(resolve, 1))

          // Save settings
          await saveSettings(settings)

          // Load settings back
          const loaded = await loadSettings()

          // updatedAt should be >= beforeSave
          return loaded.updatedAt >= beforeSave
        }),
        { numRuns: 100 }
      )
    })

    it("should have newer timestamp on subsequent saves", async () => {
      await fc.assert(
        fc.asyncProperty(appSettingsArb, appSettingsArb, async (settings1, settings2) => {
          mockStorage.clear()

          // Save first settings
          await saveSettings(settings1)
          const loaded1 = await loadSettings()
          const timestamp1 = loaded1.updatedAt

          // Small delay to ensure timestamp difference
          await new Promise((resolve) => setTimeout(resolve, 2))

          // Save second settings
          await saveSettings(settings2)
          const loaded2 = await loadSettings()
          const timestamp2 = loaded2.updatedAt

          // Second timestamp should be >= first
          return timestamp2 >= timestamp1
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Additional unit tests for change tracking and hash functions
   */
  describe("Change Tracking", () => {
    it("should track settings changes correctly", async () => {
      mockStorage.clear()

      // Initially no changes
      expect(await hasSettingsChanged()).toBe(false)

      // Mark as changed
      await markSettingsChanged()
      expect(await hasSettingsChanged()).toBe(true)

      // Clear changes
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
        }),
        { numRuns: 100 }
      )
    })

    it("should compute different hashes for different themes", () => {
      const settings1: AppSettings = { ...DEFAULT_SETTINGS, theme: "light" }
      const settings2: AppSettings = { ...DEFAULT_SETTINGS, theme: "dark" }

      const hash1 = computeSettingsHash(settings1)
      const hash2 = computeSettingsHash(settings2)

      expect(hash1).not.toBe(hash2)
    })

    it("should compute different hashes for different defaultPaymentMethod", () => {
      const settings1: AppSettings = { ...DEFAULT_SETTINGS, defaultPaymentMethod: "Cash" }
      const settings2: AppSettings = { ...DEFAULT_SETTINGS, defaultPaymentMethod: "UPI" }
      const settings3: AppSettings = {
        ...DEFAULT_SETTINGS,
        defaultPaymentMethod: undefined,
      }

      const hash1 = computeSettingsHash(settings1)
      const hash2 = computeSettingsHash(settings2)
      const hash3 = computeSettingsHash(settings3)

      expect(hash1).not.toBe(hash2)
      expect(hash1).not.toBe(hash3)
      expect(hash2).not.toBe(hash3)
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

      const hash1 = computeSettingsHash(settings1)
      const hash2 = computeSettingsHash(settings2)

      expect(hash1).toBe(hash2)
    })

    it("should save and retrieve hash correctly", async () => {
      mockStorage.clear()

      const testHash = "abc123"
      await saveSettingsHash(testHash)
      const retrieved = await getSettingsHash()

      expect(retrieved).toBe(testHash)
    })
  })

  describe("Default Settings", () => {
    it("should return default settings when storage is empty", async () => {
      mockStorage.clear()

      const loaded = await loadSettings()

      expect(loaded.theme).toBe("system")
      expect(loaded.syncSettings).toBe(false)
      expect(loaded.defaultPaymentMethod).toBeUndefined()
      expect(loaded.autoSyncEnabled).toBe(false)
      expect(loaded.autoSyncTiming).toBe("on_launch")
      expect(loaded.paymentInstruments).toEqual([])
      expect(loaded.paymentInstrumentsMigrationVersion).toBe(0)
      expect(loaded.version).toBe(5)
    })
  })

  /**
   * For any settings object with defaultPaymentMethod set, serializing for sync
   * and deserializing SHALL preserve the defaultPaymentMethod value.
   */
  describe("Settings Sync Includes Default Payment Method", () => {
    it("should preserve defaultPaymentMethod through serialize/deserialize cycle", async () => {
      await fc.assert(
        fc.asyncProperty(appSettingsArb, async (settings) => {
          mockStorage.clear()

          // Save settings (simulates sync upload)
          await saveSettings(settings)

          // Load settings back (simulates sync download)
          const loaded = await loadSettings()

          // defaultPaymentMethod should be preserved
          return loaded.defaultPaymentMethod === settings.defaultPaymentMethod
        }),
        { numRuns: 100 }
      )
    })

    it("should include defaultPaymentMethod in hash computation for sync change detection", () => {
      fc.assert(
        fc.property(
          optionalPaymentMethodTypeArb,
          optionalPaymentMethodTypeArb,
          (pm1, pm2) => {
            // Skip if both are the same
            if (pm1 === pm2) return true

            const settings1: AppSettings = {
              ...DEFAULT_SETTINGS,
              defaultPaymentMethod: pm1,
            }
            const settings2: AppSettings = {
              ...DEFAULT_SETTINGS,
              defaultPaymentMethod: pm2,
            }

            const hash1 = computeSettingsHash(settings1)
            const hash2 = computeSettingsHash(settings2)

            // Different payment methods should produce different hashes
            return hash1 !== hash2
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should preserve all payment method types through round-trip", async () => {
      await fc.assert(
        fc.asyncProperty(paymentMethodTypeArb, async (paymentMethod) => {
          mockStorage.clear()

          const settings: AppSettings = {
            ...DEFAULT_SETTINGS,
            defaultPaymentMethod: paymentMethod,
          }

          // Save settings
          await saveSettings(settings)

          // Load settings back
          const loaded = await loadSettings()

          // Payment method should be preserved exactly
          return loaded.defaultPaymentMethod === paymentMethod
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * For any settings JSON missing autoSyncEnabled or autoSyncTiming fields (from older version),
   * loading SHALL use default values (false and "on_launch" respectively).
   */
  describe(" Missing fields use defaults", () => {
    // Arbitrary for v2 settings (missing autoSyncEnabled and autoSyncTiming)
    const v2SettingsArb = fc.record({
      theme: themePreferenceArb,
      syncSettings: fc.boolean(),
      defaultPaymentMethod: optionalPaymentMethodTypeArb,
      updatedAt: fc
        .integer({ min: 1577836800000, max: 1924905600000 })
        .map((ms) => new Date(ms).toISOString()),
      version: fc.constant(2), // Old version without auto-sync fields
    })

    it("should use default autoSyncEnabled (false) when field is missing", async () => {
      await fc.assert(
        fc.asyncProperty(v2SettingsArb, async (v2Settings) => {
          mockStorage.clear()
          mockSecureStorage.clear()

          // Save v2 settings directly to storage (bypassing saveSettings to simulate old data)
          mockStorage.set("app_settings", JSON.stringify(v2Settings))

          // Load settings - should apply defaults for missing fields
          const loaded = await loadSettings()

          // autoSyncEnabled should default to false
          return loaded.autoSyncEnabled === false
        }),
        { numRuns: 100 }
      )
    })

    it("should use default autoSyncTiming (on_launch) when field is missing", async () => {
      await fc.assert(
        fc.asyncProperty(v2SettingsArb, async (v2Settings) => {
          mockStorage.clear()
          mockSecureStorage.clear()

          // Save v2 settings directly to storage (bypassing saveSettings to simulate old data)
          mockStorage.set("app_settings", JSON.stringify(v2Settings))

          // Load settings - should apply defaults for missing fields
          const loaded = await loadSettings()

          // autoSyncTiming should default to "on_launch"
          return loaded.autoSyncTiming === "on_launch"
        }),
        { numRuns: 100 }
      )
    })

    it("should preserve existing fields while applying defaults for missing ones", async () => {
      await fc.assert(
        fc.asyncProperty(v2SettingsArb, async (v2Settings) => {
          mockStorage.clear()
          mockSecureStorage.clear()

          // Save v2 settings directly to storage
          mockStorage.set("app_settings", JSON.stringify(v2Settings))

          // Load settings
          const loaded = await loadSettings()

          // Existing fields should be preserved
          return (
            loaded.theme === v2Settings.theme &&
            loaded.syncSettings === v2Settings.syncSettings &&
            loaded.defaultPaymentMethod === v2Settings.defaultPaymentMethod &&
            // New fields should have defaults
            loaded.autoSyncEnabled === false &&
            loaded.autoSyncTiming === "on_launch" &&
            // New instrument fields should have defaults
            Array.isArray(loaded.paymentInstruments) &&
            loaded.paymentInstruments.length === 0 &&
            loaded.paymentInstrumentsMigrationVersion === 0 &&
            // Version should be upgraded to 5 (v2 -> v3 -> v4 -> v5)
            loaded.version === 5
          )
        }),
        { numRuns: 100 }
      )
    })
  })
})
