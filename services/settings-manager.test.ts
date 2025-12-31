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

// Mock AsyncStorage for testing
const mockStorage: Map<string, string> = new Map()

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

// Clear mock storage before each test
beforeEach(() => {
  mockStorage.clear()
})

// Arbitrary generators for settings types
const themePreferenceArb = fc.constantFrom<ThemePreference>("light", "dark", "system")

const appSettingsArb = fc.record({
  theme: themePreferenceArb,
  syncSettings: fc.boolean(),
  updatedAt: fc
    .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31 in ms
    .map((ms) => new Date(ms).toISOString()),
  version: fc.integer({ min: 1, max: 10 }),
})

describe("Settings Manager Properties", () => {
  /**
   * Property 1: Theme persistence round-trip
   * For any valid theme preference (light, dark, system), saving it to storage
   * and then loading it back SHALL produce the same theme preference.
   *
   * **Validates: Requirements 2.2, 2.5**
   */
  describe("Property 1: Theme persistence round-trip", () => {
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
   * Property 3: Settings serialization round-trip
   * For any valid AppSettings object, serializing to JSON and deserializing
   * SHALL produce an equivalent object with all fields preserved.
   *
   * **Validates: Requirements 3.1**
   */
  describe("Property 3: Settings serialization round-trip", () => {
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
            parsed.updatedAt === settings.updatedAt &&
            parsed.version === settings.version
          )
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 4: Timestamp updates on modification
   * For any settings modification, the updatedAt timestamp SHALL be updated
   * to a value greater than or equal to the previous timestamp.
   *
   * **Validates: Requirements 3.2, 3.4**
   */
  describe("Property 4: Timestamp updates on modification", () => {
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
      expect(loaded.version).toBe(1)
    })
  })
})
