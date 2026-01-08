/**
 * Unit tests for Store Helpers
 *
 * Tests the auto-sync helper and sync state computation functions.
 */

// Mock AsyncStorage before imports
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}))

// Mock expo-secure-store before imports
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

import { computeSettingsSyncState } from "./helpers"
import {
  AppSettings,
  DEFAULT_SETTINGS,
  computeSettingsHash,
} from "../services/settings-manager"
import { DEFAULT_CATEGORIES } from "../constants/default-categories"

describe("Store Helpers", () => {
  describe("computeSettingsSyncState", () => {
    const createSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
      ...DEFAULT_SETTINGS,
      updatedAt: new Date().toISOString(),
      ...overrides,
    })

    describe("when syncedHash is null (never synced)", () => {
      it("should return 'synced' when settings match defaults", () => {
        const settings = createSettings()
        const result = computeSettingsSyncState(settings, null)
        expect(result).toBe("synced")
      })

      it("should return 'modified' when theme differs from default", () => {
        const settings = createSettings({ theme: "dark" })
        const result = computeSettingsSyncState(settings, null)
        expect(result).toBe("modified")
      })

      it("should return 'modified' when syncSettings differs from default", () => {
        const settings = createSettings({ syncSettings: true })
        const result = computeSettingsSyncState(settings, null)
        expect(result).toBe("modified")
      })

      it("should return 'modified' when autoSyncEnabled differs from default", () => {
        const settings = createSettings({ autoSyncEnabled: true })
        const result = computeSettingsSyncState(settings, null)
        expect(result).toBe("modified")
      })

      it("should return 'modified' when autoSyncTiming differs from default", () => {
        const settings = createSettings({ autoSyncTiming: "on_change" })
        const result = computeSettingsSyncState(settings, null)
        expect(result).toBe("modified")
      })

      it("should return 'modified' when defaultPaymentMethod is set", () => {
        const settings = createSettings({ defaultPaymentMethod: "Cash" })
        const result = computeSettingsSyncState(settings, null)
        expect(result).toBe("modified")
      })
    })

    describe("when syncedHash is provided (previously synced)", () => {
      it("should return 'synced' when current hash matches synced hash", () => {
        const settings = createSettings({ theme: "dark" })
        const syncedHash = computeSettingsHash(settings)

        const result = computeSettingsSyncState(settings, syncedHash)
        expect(result).toBe("synced")
      })

      it("should return 'modified' when current hash differs from synced hash", () => {
        const originalSettings = createSettings({ theme: "light" })
        const syncedHash = computeSettingsHash(originalSettings)

        const modifiedSettings = createSettings({ theme: "dark" })
        const result = computeSettingsSyncState(modifiedSettings, syncedHash)
        expect(result).toBe("modified")
      })

      it("should return 'synced' when only updatedAt differs (timestamp ignored in hash)", () => {
        const settings1 = createSettings({
          theme: "dark",
          updatedAt: "2024-01-01T00:00:00.000Z",
        })
        const syncedHash = computeSettingsHash(settings1)

        const settings2 = createSettings({
          theme: "dark",
          updatedAt: "2024-12-31T23:59:59.999Z",
        })
        const result = computeSettingsSyncState(settings2, syncedHash)
        expect(result).toBe("synced")
      })

      it("should detect changes to defaultPaymentMethod", () => {
        const originalSettings = createSettings({ defaultPaymentMethod: "Cash" })
        const syncedHash = computeSettingsHash(originalSettings)

        const modifiedSettings = createSettings({ defaultPaymentMethod: "UPI" })
        const result = computeSettingsSyncState(modifiedSettings, syncedHash)
        expect(result).toBe("modified")
      })

      it("should detect when defaultPaymentMethod is removed", () => {
        const originalSettings = createSettings({ defaultPaymentMethod: "Cash" })
        const syncedHash = computeSettingsHash(originalSettings)

        const modifiedSettings = createSettings({ defaultPaymentMethod: undefined })
        const result = computeSettingsSyncState(modifiedSettings, syncedHash)
        expect(result).toBe("modified")
      })

      it("should detect when defaultPaymentMethod is added", () => {
        const originalSettings = createSettings({ defaultPaymentMethod: undefined })
        const syncedHash = computeSettingsHash(originalSettings)

        const modifiedSettings = createSettings({ defaultPaymentMethod: "Credit Card" })
        const result = computeSettingsSyncState(modifiedSettings, syncedHash)
        expect(result).toBe("modified")
      })
    })

    describe("hash consistency", () => {
      it("should produce consistent results for same settings", () => {
        const settings = createSettings({
          theme: "dark",
          syncSettings: true,
          autoSyncEnabled: true,
          autoSyncTiming: "on_change",
          defaultPaymentMethod: "UPI",
        })
        const syncedHash = computeSettingsHash(settings)

        // Call multiple times with same inputs
        const result1 = computeSettingsSyncState(settings, syncedHash)
        const result2 = computeSettingsSyncState(settings, syncedHash)
        const result3 = computeSettingsSyncState(settings, syncedHash)

        expect(result1).toBe("synced")
        expect(result2).toBe("synced")
        expect(result3).toBe("synced")
      })

      it("should handle all theme preferences correctly", () => {
        const themes = ["light", "dark", "system"] as const

        for (const theme of themes) {
          const settings = createSettings({ theme })
          const syncedHash = computeSettingsHash(settings)
          const result = computeSettingsSyncState(settings, syncedHash)
          expect(result).toBe("synced")
        }
      })

      it("should handle all auto-sync timing options correctly", () => {
        const timings = ["on_launch", "on_change"] as const

        for (const timing of timings) {
          const settings = createSettings({ autoSyncTiming: timing })
          const syncedHash = computeSettingsHash(settings)
          const result = computeSettingsSyncState(settings, syncedHash)
          expect(result).toBe("synced")
        }
      })

      it("should handle all payment method types correctly", () => {
        const paymentMethods = [
          "Cash",
          "UPI",
          "Credit Card",
          "Debit Card",
          "Net Banking",
          "Other",
          undefined,
        ] as const

        for (const pm of paymentMethods) {
          const settings = createSettings({ defaultPaymentMethod: pm })
          const syncedHash = computeSettingsHash(settings)
          const result = computeSettingsSyncState(settings, syncedHash)
          expect(result).toBe("synced")
        }
      })
    })

    describe("edge cases", () => {
      it("should handle empty string syncedHash", () => {
        const settings = createSettings({ theme: "dark" })
        // Empty string is truthy for hash comparison, so it will compare against ""
        // This should return "modified" since the hash won't match
        const result = computeSettingsSyncState(settings, "")
        expect(result).toBe("modified")
      })

      it("should handle settings with custom categories", () => {
        const customCategories = [
          ...DEFAULT_CATEGORIES,
          {
            label: "Custom",
            icon: "star",
            color: "#FF0000",
            isDefault: false,
            order: DEFAULT_CATEGORIES.length,
            updatedAt: new Date().toISOString(),
          },
        ]
        const settings = createSettings({ categories: customCategories })
        const syncedHash = computeSettingsHash(settings)

        const result = computeSettingsSyncState(settings, syncedHash)
        expect(result).toBe("synced")
      })

      it("should detect category changes", () => {
        const originalSettings = createSettings()
        const syncedHash = computeSettingsHash(originalSettings)

        const modifiedCategories = [
          ...DEFAULT_CATEGORIES,
          {
            label: "NewCategory",
            icon: "plus",
            color: "#00FF00",
            isDefault: false,
            order: DEFAULT_CATEGORIES.length,
            updatedAt: new Date().toISOString(),
          },
        ]
        const modifiedSettings = createSettings({ categories: modifiedCategories })

        const result = computeSettingsSyncState(modifiedSettings, syncedHash)
        expect(result).toBe("modified")
      })
    })
  })
})
