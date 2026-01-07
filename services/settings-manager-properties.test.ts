/**
 * Property-based tests for Settings Manager Service
 *
 * Tests the theme resolution and change tracking functionality.
 * These tests validate the pure functions and service layer used by the settings store.
 */

import fc from "fast-check"
import { ThemePreference, AppSettings } from "./settings-manager"
import { DEFAULT_CATEGORIES } from "../constants/default-categories"

/**
 * Resolves the effective theme based on preference and system color scheme
 * This is a pure function extracted for testing purposes.
 * The same logic is used in settings-store.ts (selectEffectiveTheme)
 */
function resolveEffectiveTheme(
  preference: ThemePreference,
  systemColorScheme: "light" | "dark" | null | undefined
): "light" | "dark" {
  if (preference === "system") {
    // Default to light if system color scheme is not available
    return systemColorScheme === "dark" ? "dark" : "light"
  }
  return preference
}

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

// Import settings manager functions after mocking
import {
  markSettingsChanged,
  clearSettingsChanged,
  hasSettingsChanged,
  saveSettings,
  computeSettingsHash,
  AutoSyncTiming,
} from "./settings-manager"

// Clear mock storage before each test
beforeEach(() => {
  mockStorage.clear()
  mockSecureStorage.clear()
})

// Arbitrary generators for settings types
const themePreferenceArb = fc.constantFrom<ThemePreference>("light", "dark", "system")
const systemColorSchemeArb = fc.constantFrom<"light" | "dark" | null | undefined>(
  "light",
  "dark",
  null,
  undefined
)

const autoSyncTimingArb = fc.constantFrom<AutoSyncTiming>("on_launch", "on_change")

const appSettingsArb: fc.Arbitrary<AppSettings> = fc.record({
  theme: themePreferenceArb,
  syncSettings: fc.boolean(),
  autoSyncEnabled: fc.boolean(),
  autoSyncTiming: autoSyncTimingArb,
  categories: fc.constant(DEFAULT_CATEGORIES),
  categoriesVersion: fc.constant(1),
  updatedAt: fc
    .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31 in ms
    .map((ms) => new Date(ms).toISOString()),
  version: fc.integer({ min: 4, max: 10 }),
})

// Operation types for change tracking simulation
type Operation = { type: "modify"; settings: AppSettings } | { type: "sync" }

const operationArb: fc.Arbitrary<Operation> = fc.oneof(
  appSettingsArb.map((settings) => ({ type: "modify" as const, settings })),
  fc.constant({ type: "sync" as const })
)

describe("Settings Manager Properties", () => {
  /**
   * Property: Effective theme resolution
   * For any theme preference and system color scheme state, the effectiveTheme
   * SHALL be "light" or "dark" (never "system"), and when theme preference is
   * "system", effectiveTheme SHALL match the system color scheme.
   */
  describe("Effective theme resolution", () => {
    it("should always resolve to light or dark, never system", () => {
      fc.assert(
        fc.property(
          themePreferenceArb,
          systemColorSchemeArb,
          (preference, systemScheme) => {
            const effectiveTheme = resolveEffectiveTheme(preference, systemScheme)

            // Effective theme must be "light" or "dark", never "system"
            return effectiveTheme === "light" || effectiveTheme === "dark"
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should return the preference directly when not system", () => {
      fc.assert(
        fc.property(
          fc.constantFrom<ThemePreference>("light", "dark"),
          systemColorSchemeArb,
          (preference, systemScheme) => {
            const effectiveTheme = resolveEffectiveTheme(preference, systemScheme)

            // When preference is light or dark, it should be returned directly
            return effectiveTheme === preference
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should follow system color scheme when preference is system", () => {
      fc.assert(
        fc.property(systemColorSchemeArb, (systemScheme) => {
          const effectiveTheme = resolveEffectiveTheme("system", systemScheme)

          // When preference is system:
          // - If system is "dark", effective should be "dark"
          // - Otherwise (light, null, undefined), effective should be "light"
          if (systemScheme === "dark") {
            return effectiveTheme === "dark"
          } else {
            return effectiveTheme === "light"
          }
        }),
        { numRuns: 100 }
      )
    })

    it("should default to light when system scheme is unavailable", () => {
      fc.assert(
        fc.property(
          fc.constantFrom<null | undefined>(null, undefined),
          (systemScheme) => {
            const effectiveTheme = resolveEffectiveTheme("system", systemScheme)

            // When system scheme is null or undefined, should default to light
            return effectiveTheme === "light"
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property: Change tracking accuracy
   * For any settings state, hasUnsyncedChanges SHALL be true if and only if
   * settings have been modified since the last successful sync.
   */
  describe("Change tracking accuracy", () => {
    it("should track changes correctly after modifications", async () => {
      await fc.assert(
        fc.asyncProperty(appSettingsArb, async (settings) => {
          mockStorage.clear()

          // Initially no changes
          const initialState = await hasSettingsChanged()
          if (initialState !== false) return false

          // After modification, should have changes
          await saveSettings(settings)
          await markSettingsChanged()
          const afterModify = await hasSettingsChanged()
          if (afterModify !== true) return false

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("should clear changes after sync", async () => {
      await fc.assert(
        fc.asyncProperty(appSettingsArb, async (settings) => {
          mockStorage.clear()

          // Modify settings
          await saveSettings(settings)
          await markSettingsChanged()

          // Verify changes exist
          const beforeSync = await hasSettingsChanged()
          if (beforeSync !== true) return false

          // Clear changes (simulating successful sync)
          await clearSettingsChanged()

          // Verify no changes after sync
          const afterSync = await hasSettingsChanged()
          return afterSync === false
        }),
        { numRuns: 100 }
      )
    })

    it("should track changes correctly through operation sequences", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(operationArb, { minLength: 1, maxLength: 10 }),
          async (operations) => {
            mockStorage.clear()

            // Track expected state
            let expectedHasChanges = false

            for (const op of operations) {
              if (op.type === "modify") {
                await saveSettings(op.settings)
                await markSettingsChanged()
                expectedHasChanges = true
              } else if (op.type === "sync") {
                await clearSettingsChanged()
                expectedHasChanges = false
              }
            }

            // Verify actual state matches expected
            const actualHasChanges = await hasSettingsChanged()
            return actualHasChanges === expectedHasChanges
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should report 1 changed record when modified, 0 when synced", async () => {
      await fc.assert(
        fc.asyncProperty(appSettingsArb, async (settings) => {
          mockStorage.clear()

          // Initially 0 changes
          const initial = await hasSettingsChanged()
          const initialCount = initial ? 1 : 0
          if (initialCount !== 0) return false

          // After modification, 1 change
          await saveSettings(settings)
          await markSettingsChanged()
          const afterModify = await hasSettingsChanged()
          const modifyCount = afterModify ? 1 : 0
          if (modifyCount !== 1) return false

          // After sync, 0 changes
          await clearSettingsChanged()
          const afterSync = await hasSettingsChanged()
          const syncCount = afterSync ? 1 : 0
          return syncCount === 0
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * For any two AppSettings objects that differ only in autoSyncEnabled or autoSyncTiming,
   * the computed hashes SHALL be different.
   */
  describe("Settings hash includes all fields", () => {
    it("should produce different hashes when autoSyncEnabled differs", () => {
      fc.assert(
        fc.property(appSettingsArb, (baseSettings) => {
          // Create two settings that differ only in autoSyncEnabled
          const settings1: AppSettings = { ...baseSettings, autoSyncEnabled: true }
          const settings2: AppSettings = { ...baseSettings, autoSyncEnabled: false }

          const hash1 = computeSettingsHash(settings1)
          const hash2 = computeSettingsHash(settings2)

          // Hashes should be different when autoSyncEnabled differs
          return hash1 !== hash2
        }),
        { numRuns: 100 }
      )
    })

    it("should produce different hashes when autoSyncTiming differs", () => {
      fc.assert(
        fc.property(appSettingsArb, (baseSettings) => {
          // Create two settings that differ only in autoSyncTiming
          const settings1: AppSettings = { ...baseSettings, autoSyncTiming: "on_launch" }
          const settings2: AppSettings = { ...baseSettings, autoSyncTiming: "on_change" }

          const hash1 = computeSettingsHash(settings1)
          const hash2 = computeSettingsHash(settings2)

          // Hashes should be different when autoSyncTiming differs
          return hash1 !== hash2
        }),
        { numRuns: 100 }
      )
    })

    it("should produce same hash when only updatedAt differs", () => {
      fc.assert(
        fc.property(
          appSettingsArb,
          fc
            .integer({ min: 1577836800000, max: 1924905600000 })
            .map((ms) => new Date(ms).toISOString()),
          (baseSettings, newUpdatedAt) => {
            // Create two settings that differ only in updatedAt
            const settings1: AppSettings = { ...baseSettings }
            const settings2: AppSettings = { ...baseSettings, updatedAt: newUpdatedAt }

            const hash1 = computeSettingsHash(settings1)
            const hash2 = computeSettingsHash(settings2)

            // Hashes should be the same when only updatedAt differs
            return hash1 === hash2
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
