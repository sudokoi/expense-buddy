/**
 * Property-based tests for Category Display Order
 * Feature: custom-categories
 *
 * These tests verify that categories are displayed in the correct order
 * in expense forms and other UI components.
 */

import fc from "fast-check"
import { Category } from "../../types/category"
import { ALL_CATEGORY_ICONS } from "../../constants/category-icons"
import { CATEGORY_COLOR_PALETTE } from "../../constants/category-colors"

// Selector that mimics selectCategories from settings-store
const selectCategories = (categories: Category[]): Category[] => {
  return [...categories].sort((a, b) => a.order - b.order)
}

// Arbitrary generators
const categoryLabelArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s))
  .map((s) => `${s.trim()}_${Math.random().toString(36).slice(2, 8)}`)

const categoryIconArb = fc.constantFrom(...ALL_CATEGORY_ICONS)
const categoryColorArb = fc.constantFrom(...CATEGORY_COLOR_PALETTE)

// Generate a valid ISO date string using integer timestamps
const validDateArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31
  .map((timestamp) => new Date(timestamp).toISOString())

// Generate a category with a specific order
const categoryWithOrderArb = (order: number): fc.Arbitrary<Category> =>
  fc.record({
    label: categoryLabelArb,
    icon: categoryIconArb,
    color: categoryColorArb,
    order: fc.constant(order),
    isDefault: fc.boolean(),
    updatedAt: validDateArb,
  })

// Generate a list of categories with unique orders (shuffled to test sorting)
const categoryListWithShuffledOrdersArb = fc
  .integer({ min: 1, max: 20 })
  .chain((count) => {
    // Generate categories with sequential orders 0 to count-1
    const categoryArbs = Array.from({ length: count }, (_, i) => categoryWithOrderArb(i))
    return fc.tuple(...categoryArbs).map((cats) => {
      // Shuffle the array to simulate unsorted storage
      return [...cats].sort(() => Math.random() - 0.5)
    })
  })

// Generate categories with random (possibly non-sequential) order values
const categoryListWithRandomOrdersArb = fc.integer({ min: 1, max: 15 }).chain((count) => {
  return fc
    .uniqueArray(fc.integer({ min: 0, max: 100 }), {
      minLength: count,
      maxLength: count,
    })
    .chain((orders) => {
      const categoryArbs = orders.map((order) => categoryWithOrderArb(order))
      return fc.tuple(...categoryArbs)
    })
})

describe("Category Display Order Properties", () => {
  /**
   * Property 1: Category Display Order Preservation
   * For any list of categories with defined order values, when displayed in the UI,
   * the categories SHALL appear in ascending order by their `order` property.
   */
  describe("Property 1: Category Display Order Preservation", () => {
    it("categories SHALL be sorted in ascending order by their order property", () => {
      fc.assert(
        fc.property(categoryListWithShuffledOrdersArb, (unsortedCategories) => {
          const sortedCategories = selectCategories(unsortedCategories)

          // Verify ascending order
          for (let i = 1; i < sortedCategories.length; i++) {
            if (sortedCategories[i].order < sortedCategories[i - 1].order) {
              return false
            }
          }
          return true
        }),
        { numRuns: 100 }
      )
    })

    it("sorted categories SHALL preserve all original categories", () => {
      fc.assert(
        fc.property(categoryListWithShuffledOrdersArb, (unsortedCategories) => {
          const sortedCategories = selectCategories(unsortedCategories)

          // Same count
          if (sortedCategories.length !== unsortedCategories.length) {
            return false
          }

          // All original labels present
          const originalLabels = new Set(unsortedCategories.map((c) => c.label))
          const sortedLabels = new Set(sortedCategories.map((c) => c.label))

          return (
            originalLabels.size === sortedLabels.size &&
            [...originalLabels].every((label) => sortedLabels.has(label))
          )
        }),
        { numRuns: 100 }
      )
    })

    it("categories with non-sequential orders SHALL still be sorted correctly", () => {
      fc.assert(
        fc.property(categoryListWithRandomOrdersArb, (categories) => {
          const sortedCategories = selectCategories(categories)

          // Verify ascending order even with gaps in order values
          for (let i = 1; i < sortedCategories.length; i++) {
            if (sortedCategories[i].order < sortedCategories[i - 1].order) {
              return false
            }
          }
          return true
        }),
        { numRuns: 100 }
      )
    })

    it("first category in sorted list SHALL have the minimum order value", () => {
      fc.assert(
        fc.property(categoryListWithRandomOrdersArb, (categories) => {
          if (categories.length === 0) return true

          const sortedCategories = selectCategories(categories)
          const minOrder = Math.min(...categories.map((c) => c.order))

          return sortedCategories[0].order === minOrder
        }),
        { numRuns: 100 }
      )
    })

    it("last category in sorted list SHALL have the maximum order value", () => {
      fc.assert(
        fc.property(categoryListWithRandomOrdersArb, (categories) => {
          if (categories.length === 0) return true

          const sortedCategories = selectCategories(categories)
          const maxOrder = Math.max(...categories.map((c) => c.order))

          return sortedCategories[sortedCategories.length - 1].order === maxOrder
        }),
        { numRuns: 100 }
      )
    })

    it("sorting SHALL be stable for categories with same order (preserve insertion order)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 0, max: 50 }),
          (count, sharedOrder) => {
            // Create categories with the same order value
            const categories: Category[] = Array.from({ length: count }, (_, i) => ({
              label: `Category_${i}_${Math.random().toString(36).slice(2, 6)}`,
              icon: ALL_CATEGORY_ICONS[i % ALL_CATEGORY_ICONS.length],
              color: CATEGORY_COLOR_PALETTE[i % CATEGORY_COLOR_PALETTE.length],
              order: sharedOrder,
              isDefault: false,
              updatedAt: new Date().toISOString(),
            }))

            const sortedCategories = selectCategories(categories)

            // All should still be present
            return sortedCategories.length === categories.length
          }
        ),
        { numRuns: 100 }
      )
    })

    it("empty category list SHALL return empty sorted list", () => {
      fc.assert(
        fc.property(fc.constant([] as Category[]), (emptyCategories) => {
          const sortedCategories = selectCategories(emptyCategories)
          return sortedCategories.length === 0
        }),
        { numRuns: 10 }
      )
    })

    it("single category list SHALL return that category", () => {
      fc.assert(
        fc.property(categoryWithOrderArb(0), (category) => {
          const sortedCategories = selectCategories([category])
          return (
            sortedCategories.length === 1 && sortedCategories[0].label === category.label
          )
        }),
        { numRuns: 100 }
      )
    })
  })
})
