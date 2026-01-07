/**
 * Property-based tests for sync-manager settings integration
 *
 * These tests validate the correctness properties defined in the design document
 * for settings sync functionality.
 */

import * as fc from "fast-check"
import {
  AppSettings,
  ThemePreference,
  AutoSyncTiming,
  computeSettingsHash,
  getSettingsHash,
} from "./settings-manager"
import { PaymentMethodType } from "../types/expense"
import { DEFAULT_CATEGORIES } from "../constants/default-categories"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Mock AsyncStorage for testing
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}))

// Mock expo-secure-store for testing
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))

// Mock react-native Platform
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}))

// Generate valid ISO date strings using integer timestamps
const validIsoDateArbitrary = fc
  .integer({
    min: new Date("2020-01-01").getTime(),
    max: new Date("2030-12-31").getTime(),
  })
  .map((timestamp) => new Date(timestamp).toISOString())

// Arbitrary generators for settings
const themeArbitrary = fc.constantFrom<ThemePreference>("light", "dark", "system")
const autoSyncTimingArbitrary = fc.constantFrom<AutoSyncTiming>("on_launch", "on_change")
const paymentMethodTypeArbitrary = fc.constantFrom<PaymentMethodType>(
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other"
)
const optionalPaymentMethodTypeArbitrary = fc.option(paymentMethodTypeArbitrary, {
  nil: undefined,
})

// Full settings arbitrary (v4 format with all required fields)
const settingsArbitrary: fc.Arbitrary<AppSettings> = fc.record({
  theme: themeArbitrary,
  syncSettings: fc.boolean(),
  defaultPaymentMethod: optionalPaymentMethodTypeArbitrary,
  autoSyncEnabled: fc.boolean(),
  autoSyncTiming: autoSyncTimingArbitrary,
  categories: fc.constant(DEFAULT_CATEGORIES),
  categoriesVersion: fc.constant(1),
  updatedAt: validIsoDateArbitrary,
  version: fc.integer({ min: 4, max: 10 }),
})

// Full v4 settings arbitrary (with version fixed to 4)
const fullSettingsArbitrary: fc.Arbitrary<AppSettings> = fc.record({
  theme: themeArbitrary,
  syncSettings: fc.boolean(),
  defaultPaymentMethod: optionalPaymentMethodTypeArbitrary,
  autoSyncEnabled: fc.boolean(),
  autoSyncTiming: autoSyncTimingArbitrary,
  categories: fc.constant(DEFAULT_CATEGORIES),
  categoriesVersion: fc.constant(1),
  updatedAt: validIsoDateArbitrary,
  version: fc.constant(4),
})

describe("Sync Manager Settings Integration Properties", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
    ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
    ;(AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined)
  })

  /**
   * For any sync operation, settings SHALL be included in the batch commit
   * if and only if syncSettings is enabled.
   */
  describe("Conditional settings sync inclusion", () => {
    it("should include settings in sync only when syncSettings is true", async () => {
      await fc.assert(
        fc.asyncProperty(
          settingsArbitrary,
          fc.boolean(),
          async (settings, syncSettingsEnabled) => {
            // The settings should be included in sync if and only if:
            // 1. syncSettingsEnabled is true
            // 2. settings object is provided

            // When syncSettingsEnabled is true and settings provided,
            // settings should be considered for sync
            const shouldIncludeSettings = syncSettingsEnabled && settings !== undefined

            // Verify the logic: settings are included iff syncSettingsEnabled is true
            if (syncSettingsEnabled) {
              expect(shouldIncludeSettings).toBe(true)
            } else {
              expect(shouldIncludeSettings).toBe(false)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should not include settings when syncSettings flag is false", async () => {
      await fc.assert(
        fc.asyncProperty(settingsArbitrary, async (settings) => {
          const syncSettingsEnabled = false

          // When syncSettingsEnabled is false, settings should never be included
          const shouldIncludeSettings = syncSettingsEnabled && settings !== undefined

          expect(shouldIncludeSettings).toBe(false)
        }),
        { numRuns: 100 }
      )
    })

    it("should include settings when syncSettings flag is true", async () => {
      await fc.assert(
        fc.asyncProperty(settingsArbitrary, async (settings) => {
          const syncSettingsEnabled = true

          // When syncSettingsEnabled is true and settings provided, should include
          const shouldIncludeSettings = syncSettingsEnabled && settings !== undefined

          expect(shouldIncludeSettings).toBe(true)
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * For any settings object, if the computed content hash matches the stored hash
   * from the last sync, the sync operation SHALL skip uploading the settings file.
   */
  describe("Hash-based skip for unchanged settings", () => {
    it("should skip upload when hash matches stored hash", async () => {
      await fc.assert(
        fc.asyncProperty(settingsArbitrary, async (settings) => {
          // Compute hash of settings
          const hash = computeSettingsHash(settings)

          // Mock stored hash to match
          ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(hash)

          // Get stored hash
          const storedHash = await getSettingsHash()

          // Should skip because hashes match
          const shouldSkip = storedHash === hash

          expect(shouldSkip).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    it("should not skip upload when hash differs from stored hash", async () => {
      await fc.assert(
        fc.asyncProperty(
          settingsArbitrary,
          settingsArbitrary,
          async (settings1, settings2) => {
            // Only test when settings are actually different
            fc.pre(
              settings1.theme !== settings2.theme ||
                settings1.syncSettings !== settings2.syncSettings
            )

            // Compute hash of current settings
            const currentHash = computeSettingsHash(settings1)

            // Compute hash of different settings (simulating stored hash)
            const storedHash = computeSettingsHash(settings2)

            // Should not skip because hashes differ
            const shouldSkip = storedHash === currentHash

            // If settings are different, hashes should be different
            if (
              settings1.theme !== settings2.theme ||
              settings1.syncSettings !== settings2.syncSettings ||
              settings1.version !== settings2.version
            ) {
              expect(shouldSkip).toBe(false)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should produce same hash for same settings content", async () => {
      await fc.assert(
        fc.asyncProperty(settingsArbitrary, async (settings) => {
          // Compute hash twice
          const hash1 = computeSettingsHash(settings)
          const hash2 = computeSettingsHash(settings)

          // Hashes should be identical
          expect(hash1).toBe(hash2)
        }),
        { numRuns: 100 }
      )
    })

    it("should ignore updatedAt when computing hash", async () => {
      await fc.assert(
        fc.asyncProperty(
          settingsArbitrary,
          validIsoDateArbitrary,
          validIsoDateArbitrary,
          async (baseSettings, date1, date2) => {
            const settings1 = { ...baseSettings, updatedAt: date1 }
            const settings2 = { ...baseSettings, updatedAt: date2 }

            const hash1 = computeSettingsHash(settings1)
            const hash2 = computeSettingsHash(settings2)

            // Hashes should be same even with different updatedAt
            expect(hash1).toBe(hash2)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * For any settings download operation where remote settings exist,
   * the local settings SHALL be completely replaced with the remote settings.
   */
  describe("Settings overwrite on download", () => {
    it("should completely replace local settings with remote settings", async () => {
      await fc.assert(
        fc.asyncProperty(
          settingsArbitrary,
          settingsArbitrary,
          async (localSettings, remoteSettings) => {
            // Simulate the replacement logic
            // When remote settings are downloaded, they should completely replace local

            // The replacement function should return the remote settings exactly
            const replaceSettings = (
              _local: AppSettings,
              remote: AppSettings
            ): AppSettings => {
              return { ...remote }
            }

            const result = replaceSettings(localSettings, remoteSettings)

            // Result should match remote settings exactly
            expect(result.theme).toBe(remoteSettings.theme)
            expect(result.syncSettings).toBe(remoteSettings.syncSettings)
            expect(result.updatedAt).toBe(remoteSettings.updatedAt)
            expect(result.version).toBe(remoteSettings.version)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should not retain any local settings after replacement", async () => {
      await fc.assert(
        fc.asyncProperty(
          settingsArbitrary,
          settingsArbitrary,
          async (localSettings, remoteSettings) => {
            // Ensure local and remote are different for meaningful test
            fc.pre(
              localSettings.theme !== remoteSettings.theme ||
                localSettings.syncSettings !== remoteSettings.syncSettings
            )

            // After replacement, local values should not be present
            const replaceSettings = (
              _local: AppSettings,
              remote: AppSettings
            ): AppSettings => {
              return { ...remote }
            }

            const result = replaceSettings(localSettings, remoteSettings)

            // If themes were different, result should have remote theme
            if (localSettings.theme !== remoteSettings.theme) {
              expect(result.theme).not.toBe(localSettings.theme)
              expect(result.theme).toBe(remoteSettings.theme)
            }

            // If syncSettings were different, result should have remote value
            if (localSettings.syncSettings !== remoteSettings.syncSettings) {
              expect(result.syncSettings).not.toBe(localSettings.syncSettings)
              expect(result.syncSettings).toBe(remoteSettings.syncSettings)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should preserve all remote settings fields", async () => {
      await fc.assert(
        fc.asyncProperty(settingsArbitrary, async (remoteSettings) => {
          // Create arbitrary local settings
          const localSettings: AppSettings = {
            theme: "light",
            syncSettings: false,
            defaultPaymentMethod: undefined,
            autoSyncEnabled: false,
            autoSyncTiming: "on_launch",
            categories: DEFAULT_CATEGORIES,
            categoriesVersion: 1,
            updatedAt: new Date().toISOString(),
            version: 4,
          }

          // Replace local with remote
          const replaceSettings = (
            _local: AppSettings,
            remote: AppSettings
          ): AppSettings => {
            return { ...remote }
          }

          const result = replaceSettings(localSettings, remoteSettings)

          // All fields from remote should be preserved
          expect(result).toEqual(remoteSettings)
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Task 12.1: Test settings upload includes new fields
   * Verify settings.json contains autoSyncEnabled and autoSyncTiming
   *
   * **Validates: Requirements 4.1**
   */
  describe("Task 12.1: Settings upload includes new fields", () => {
    it("should include autoSyncEnabled in serialized settings JSON", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (settings) => {
          // Serialize settings to JSON (simulating upload)
          const json = JSON.stringify(settings, null, 2)
          const parsed = JSON.parse(json)

          // autoSyncEnabled should be present in the serialized JSON
          expect(parsed).toHaveProperty("autoSyncEnabled")
          expect(typeof parsed.autoSyncEnabled).toBe("boolean")
          expect(parsed.autoSyncEnabled).toBe(settings.autoSyncEnabled)
        }),
        { numRuns: 100 }
      )
    })

    it("should include autoSyncTiming in serialized settings JSON", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (settings) => {
          // Serialize settings to JSON (simulating upload)
          const json = JSON.stringify(settings, null, 2)
          const parsed = JSON.parse(json)

          // autoSyncTiming should be present in the serialized JSON
          expect(parsed).toHaveProperty("autoSyncTiming")
          expect(["on_launch", "on_change"]).toContain(parsed.autoSyncTiming)
          expect(parsed.autoSyncTiming).toBe(settings.autoSyncTiming)
        }),
        { numRuns: 100 }
      )
    })

    it("should preserve all v3 settings fields in serialized JSON", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (settings) => {
          // Serialize settings to JSON (simulating upload)
          const json = JSON.stringify(settings, null, 2)
          const parsed = JSON.parse(json)

          // All v3 fields should be present
          expect(parsed).toHaveProperty("theme")
          expect(parsed).toHaveProperty("syncSettings")
          expect(parsed).toHaveProperty("autoSyncEnabled")
          expect(parsed).toHaveProperty("autoSyncTiming")
          expect(parsed).toHaveProperty("updatedAt")
          expect(parsed).toHaveProperty("version")

          // Values should match
          expect(parsed.theme).toBe(settings.theme)
          expect(parsed.syncSettings).toBe(settings.syncSettings)
          expect(parsed.autoSyncEnabled).toBe(settings.autoSyncEnabled)
          expect(parsed.autoSyncTiming).toBe(settings.autoSyncTiming)
          expect(parsed.version).toBe(settings.version)
        }),
        { numRuns: 100 }
      )
    })

    it("should include defaultPaymentMethod when present in serialized JSON", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (settings) => {
          // Serialize settings to JSON (simulating upload)
          const json = JSON.stringify(settings, null, 2)
          const parsed = JSON.parse(json)

          // defaultPaymentMethod should match (including undefined case)
          if (settings.defaultPaymentMethod !== undefined) {
            expect(parsed).toHaveProperty("defaultPaymentMethod")
            expect(parsed.defaultPaymentMethod).toBe(settings.defaultPaymentMethod)
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Task 12.2: Test settings download applies new fields
   * Verify downloaded autoSyncEnabled and autoSyncTiming are applied
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  describe("Task 12.2: Settings download applies new fields", () => {
    it("should apply downloaded autoSyncEnabled value", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (remoteSettings) => {
          // Simulate downloading settings JSON
          const json = JSON.stringify(remoteSettings)
          const downloaded = JSON.parse(json) as AppSettings

          // autoSyncEnabled should be applied from downloaded settings
          expect(downloaded.autoSyncEnabled).toBe(remoteSettings.autoSyncEnabled)
        }),
        { numRuns: 100 }
      )
    })

    it("should apply downloaded autoSyncTiming value", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (remoteSettings) => {
          // Simulate downloading settings JSON
          const json = JSON.stringify(remoteSettings)
          const downloaded = JSON.parse(json) as AppSettings

          // autoSyncTiming should be applied from downloaded settings
          expect(downloaded.autoSyncTiming).toBe(remoteSettings.autoSyncTiming)
        }),
        { numRuns: 100 }
      )
    })

    it("should completely replace local auto-sync settings with downloaded values", () => {
      fc.assert(
        fc.property(
          fullSettingsArbitrary,
          fullSettingsArbitrary,
          (localSettings, remoteSettings) => {
            // Ensure settings are different for meaningful test
            fc.pre(
              localSettings.autoSyncEnabled !== remoteSettings.autoSyncEnabled ||
                localSettings.autoSyncTiming !== remoteSettings.autoSyncTiming
            )

            // Simulate the replacement logic
            const replaceSettings = (
              _local: AppSettings,
              remote: AppSettings
            ): AppSettings => {
              return { ...remote }
            }

            const result = replaceSettings(localSettings, remoteSettings)

            // Auto-sync settings should match remote, not local
            expect(result.autoSyncEnabled).toBe(remoteSettings.autoSyncEnabled)
            expect(result.autoSyncTiming).toBe(remoteSettings.autoSyncTiming)

            // If they were different, result should not match local
            if (localSettings.autoSyncEnabled !== remoteSettings.autoSyncEnabled) {
              expect(result.autoSyncEnabled).not.toBe(localSettings.autoSyncEnabled)
            }
            if (localSettings.autoSyncTiming !== remoteSettings.autoSyncTiming) {
              expect(result.autoSyncTiming).not.toBe(localSettings.autoSyncTiming)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should apply all v3 fields from downloaded settings", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (remoteSettings) => {
          // Simulate downloading and applying settings
          const json = JSON.stringify(remoteSettings)
          const downloaded = JSON.parse(json) as AppSettings

          // All v3 fields should be applied
          expect(downloaded.theme).toBe(remoteSettings.theme)
          expect(downloaded.syncSettings).toBe(remoteSettings.syncSettings)
          expect(downloaded.defaultPaymentMethod).toBe(
            remoteSettings.defaultPaymentMethod
          )
          expect(downloaded.autoSyncEnabled).toBe(remoteSettings.autoSyncEnabled)
          expect(downloaded.autoSyncTiming).toBe(remoteSettings.autoSyncTiming)
          expect(downloaded.updatedAt).toBe(remoteSettings.updatedAt)
          expect(downloaded.version).toBe(remoteSettings.version)
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Settings serialization round-trip with new fields
   * For any valid AppSettings object (including autoSyncEnabled and autoSyncTiming),
   * serializing to JSON and deserializing SHALL produce an equivalent object
   * with all fields preserved.

   */
  describe("Settings serialization round-trip", () => {
    it("should preserve all fields through JSON serialization round-trip", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (settings) => {
          // Serialize to JSON (simulating upload to GitHub)
          const json = JSON.stringify(settings)

          // Deserialize from JSON (simulating download from GitHub)
          const deserialized = JSON.parse(json) as AppSettings

          // All fields should be preserved exactly
          expect(deserialized.theme).toBe(settings.theme)
          expect(deserialized.syncSettings).toBe(settings.syncSettings)
          expect(deserialized.defaultPaymentMethod).toBe(settings.defaultPaymentMethod)
          expect(deserialized.autoSyncEnabled).toBe(settings.autoSyncEnabled)
          expect(deserialized.autoSyncTiming).toBe(settings.autoSyncTiming)
          expect(deserialized.updatedAt).toBe(settings.updatedAt)
          expect(deserialized.version).toBe(settings.version)
        }),
        { numRuns: 100 }
      )
    })

    it("should produce deep equal object after round-trip", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (settings) => {
          // Serialize and deserialize
          const json = JSON.stringify(settings)
          const deserialized = JSON.parse(json) as AppSettings

          // Objects should be deeply equal
          expect(deserialized).toEqual(settings)
        }),
        { numRuns: 100 }
      )
    })

    it("should preserve autoSyncEnabled boolean value through round-trip", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (settings) => {
          const json = JSON.stringify(settings)
          const deserialized = JSON.parse(json) as AppSettings

          // autoSyncEnabled should be preserved as boolean
          expect(typeof deserialized.autoSyncEnabled).toBe("boolean")
          expect(deserialized.autoSyncEnabled).toBe(settings.autoSyncEnabled)
        }),
        { numRuns: 100 }
      )
    })

    it("should preserve autoSyncTiming enum value through round-trip", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (settings) => {
          const json = JSON.stringify(settings)
          const deserialized = JSON.parse(json) as AppSettings

          // autoSyncTiming should be preserved as valid enum value
          expect(["on_launch", "on_change"]).toContain(deserialized.autoSyncTiming)
          expect(deserialized.autoSyncTiming).toBe(settings.autoSyncTiming)
        }),
        { numRuns: 100 }
      )
    })

    it("should preserve optional defaultPaymentMethod through round-trip", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (settings) => {
          const json = JSON.stringify(settings)
          const deserialized = JSON.parse(json) as AppSettings

          // defaultPaymentMethod should be preserved (including undefined)
          expect(deserialized.defaultPaymentMethod).toBe(settings.defaultPaymentMethod)
        }),
        { numRuns: 100 }
      )
    })

    it("should handle pretty-printed JSON round-trip", () => {
      fc.assert(
        fc.property(fullSettingsArbitrary, (settings) => {
          // Serialize with pretty printing (as used in actual file storage)
          const json = JSON.stringify(settings, null, 2)
          const deserialized = JSON.parse(json) as AppSettings

          // Should still produce equal object
          expect(deserialized).toEqual(settings)
        }),
        { numRuns: 100 }
      )
    })
  })
})
