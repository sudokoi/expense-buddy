/**
 * Property-based tests for settings hydration
 *
 * NOTE: This is not a UI test.
 */

import * as fc from "fast-check"

// Mock AsyncStorage before importing settings-manager
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}))

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))

// Mock react-native Platform
jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}))

import { DEFAULT_SETTINGS, hydrateSettingsFromJson } from "../settings-manager"
import type { AppSettings } from "../settings-manager"

const isoDateArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 })
  .map((ts) => new Date(ts).toISOString())

describe("hydrateSettingsFromJson (properties)", () => {
  it("SHALL always return a complete AppSettings object", () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        const hydrated = hydrateSettingsFromJson(raw)

        // required fields
        expect(hydrated).toHaveProperty("theme")
        expect(hydrated).toHaveProperty("syncSettings")
        expect(hydrated).toHaveProperty("autoSyncEnabled")
        expect(hydrated).toHaveProperty("autoSyncTiming")
        expect(hydrated).toHaveProperty("categories")
        expect(hydrated).toHaveProperty("paymentInstruments")
        expect(hydrated).toHaveProperty("updatedAt")
        expect(hydrated).toHaveProperty("version")

        expect(Array.isArray(hydrated.categories)).toBe(true)
        expect(Array.isArray(hydrated.paymentInstruments)).toBe(true)
        expect(typeof hydrated.syncSettings).toBe("boolean")
        expect(typeof hydrated.autoSyncEnabled).toBe("boolean")

        // version is always bumped to at least current
        expect(hydrated.version).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.version)
      }),
      { numRuns: 200 }
    )
  })

  it("SHALL preserve provided paymentInstruments array when present", () => {
    const rawSettingsArb = fc.record({
      paymentInstruments: fc.array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0),
          method: fc.constantFrom("Credit Card", "Debit Card", "UPI"),
          nickname: fc
            .string({ minLength: 1, maxLength: 30 })
            .filter((s) => s.trim().length > 0),
          lastDigits: fc.string({ minLength: 1, maxLength: 6 }).filter((s) => /^[0-9]+$/.test(s)),
          createdAt: isoDateArb,
          updatedAt: isoDateArb,
          deletedAt: fc.option(isoDateArb, { nil: undefined }),
        }),
        { minLength: 0, maxLength: 10 }
      ),
    })

    fc.assert(
      fc.property(rawSettingsArb, (raw) => {
        const hydrated = hydrateSettingsFromJson(raw) as AppSettings
        expect(hydrated.paymentInstruments).toEqual(raw.paymentInstruments)
      }),
      { numRuns: 200 }
    )
  })
})
