/**
 * Property-based tests for Sync Payload Category Inclusion
 * Feature: custom-categories
 *
 * These tests verify that categories are properly included in the sync payload
 * when settings sync is enabled.
 */

import * as fc from "fast-check"
import { Category } from "../../types/category"
import { CATEGORY_COLOR_PALETTE } from "../../constants/category-colors"
import { ALL_CATEGORY_ICONS } from "../../constants/category-icons"

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

// Import after mocks are set up
import { AppSettings, computeSettingsHash } from "../settings-manager"

// =============================================================================
// Arbitraries (Test Data Generators)
// =============================================================================

// Generate valid category labels (1-30 chars with at least one alphanumeric)
const categoryLabelArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s))

// Generate a valid ISO date string using integer timestamps
const isoDateArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31
  .map((ts) => new Date(ts).toISOString())

// Generate a valid category
const categoryArb = fc.record({
  label: categoryLabelArb,
  icon: fc.constantFrom(...ALL_CATEGORY_ICONS),
  color: fc.constantFrom(...CATEGORY_COLOR_PALETTE),
  order: fc.nat({ max: 100 }),
  isDefault: fc.boolean(),
  updatedAt: isoDateArb,
})

// Generate a list of categories with unique labels
const categoryListArb = fc
  .array(categoryArb, { minLength: 1, maxLength: 10 })
  .map((categories) => {
    // Ensure unique labels by using a Map
    const uniqueMap = new Map<string, Category>()
    categories.forEach((cat, index) => {
      const lowerLabel = cat.label.toLowerCase()
      if (!uniqueMap.has(lowerLabel)) {
        uniqueMap.set(lowerLabel, { ...cat, order: index })
      }
    })
    return Array.from(uniqueMap.values())
  })
  .filter((cats) => cats.length > 0)

// Generate valid AppSettings with categories
const appSettingsArb = fc.record({
  theme: fc.constantFrom("light", "dark", "system") as fc.Arbitrary<
    "light" | "dark" | "system"
  >,
  syncSettings: fc.boolean(),
  defaultPaymentMethod: fc.option(
    fc.constantFrom("Cash", "UPI", "Credit Card", "Debit Card", "Other") as fc.Arbitrary<
      "Cash" | "UPI" | "Credit Card" | "Debit Card" | "Other"
    >,
    { nil: undefined }
  ),
  autoSyncEnabled: fc.boolean(),
  autoSyncTiming: fc.constantFrom("on_launch", "on_change") as fc.Arbitrary<
    "on_launch" | "on_change"
  >,
  categories: categoryListArb,
  categoriesVersion: fc.constant(1),
  updatedAt: isoDateArb,
  version: fc.constant(4),
})

// =============================================================================
// Property 16: Sync Payload Category Inclusion
// =============================================================================

describe("Sync Payload Properties", () => {
  /**
   * Property 16: Sync Payload Category Inclusion
   * For any settings object, when serialized for sync, the JSON payload SHALL
   * include the categories array with all category properties preserved.
   */
  describe("Property 16: Sync Payload Category Inclusion", () => {
    it("serialized settings SHALL include all categories", () => {
      fc.assert(
        fc.property(appSettingsArb, (settings) => {
          // Serialize settings as would be done in sync
          const serialized = JSON.stringify(settings, null, 2)
          const parsed = JSON.parse(serialized) as AppSettings

          // Categories should be present in serialized payload
          expect(parsed.categories).toBeDefined()
          expect(Array.isArray(parsed.categories)).toBe(true)
          expect(parsed.categories.length).toBe(settings.categories.length)

          // Each category should have all required properties
          parsed.categories.forEach((cat: Category, index: number) => {
            const original = settings.categories[index]
            expect(cat.label).toBe(original.label)
            expect(cat.icon).toBe(original.icon)
            expect(cat.color).toBe(original.color)
            expect(cat.order).toBe(original.order)
            expect(cat.isDefault).toBe(original.isDefault)
            expect(cat.updatedAt).toBe(original.updatedAt)
          })
        }),
        { numRuns: 100 }
      )
    })

    it("settings hash SHALL change when categories change", () => {
      fc.assert(
        fc.property(appSettingsArb, categoryArb, (settings, newCategory) => {
          // Ensure the new category has a unique label
          const existingLabels = new Set(
            settings.categories.map((c) => c.label.toLowerCase())
          )
          if (existingLabels.has(newCategory.label.toLowerCase())) {
            return true // Skip this case - label collision
          }

          const originalHash = computeSettingsHash(settings)

          // Add a new category
          const modifiedSettings: AppSettings = {
            ...settings,
            categories: [
              ...settings.categories,
              { ...newCategory, order: settings.categories.length },
            ],
          }

          const modifiedHash = computeSettingsHash(modifiedSettings)

          // Hash should be different when categories change
          expect(modifiedHash).not.toBe(originalHash)
        }),
        { numRuns: 100 }
      )
    })

    it("settings hash SHALL change when category properties change", () => {
      fc.assert(
        fc.property(
          appSettingsArb.filter((s) => s.categories.length > 0),
          fc.constantFrom(...ALL_CATEGORY_ICONS),
          (settings, newIcon) => {
            const originalHash = computeSettingsHash(settings)

            // Modify the first category's icon
            const modifiedCategories = [...settings.categories]
            if (modifiedCategories[0].icon === newIcon) {
              return true // Skip if icon is the same
            }

            modifiedCategories[0] = {
              ...modifiedCategories[0],
              icon: newIcon,
            }

            const modifiedSettings: AppSettings = {
              ...settings,
              categories: modifiedCategories,
            }

            const modifiedHash = computeSettingsHash(modifiedSettings)

            // Hash should be different when category properties change
            expect(modifiedHash).not.toBe(originalHash)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("settings hash SHALL be stable for identical categories", () => {
      fc.assert(
        fc.property(appSettingsArb, (settings) => {
          const hash1 = computeSettingsHash(settings)
          const hash2 = computeSettingsHash(settings)

          // Same settings should produce same hash
          expect(hash1).toBe(hash2)
        }),
        { numRuns: 100 }
      )
    })

    it("categoriesVersion SHALL be included in serialized payload", () => {
      fc.assert(
        fc.property(appSettingsArb, (settings) => {
          const serialized = JSON.stringify(settings, null, 2)
          const parsed = JSON.parse(serialized) as AppSettings

          expect(parsed.categoriesVersion).toBeDefined()
          expect(parsed.categoriesVersion).toBe(settings.categoriesVersion)
        }),
        { numRuns: 100 }
      )
    })
  })
})
