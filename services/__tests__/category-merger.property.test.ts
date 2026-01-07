/**
 * Property-based tests for CategoryMerger
 * Feature: custom-categories
 */

import fc from "fast-check"
import { mergeCategories } from "../category-merger"
import { Category } from "../../types/category"
import { CATEGORY_COLOR_PALETTE } from "../../constants/category-colors"
import { ALL_CATEGORY_ICONS } from "../../constants/category-icons"

// Arbitrary generators for categories
const categoryLabelArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s))
  .map((s) => s.trim())

const categoryColorArb = fc.constantFrom(...CATEGORY_COLOR_PALETTE)

const categoryIconArb = fc.constantFrom(...ALL_CATEGORY_ICONS)

const isoDateStringArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 })
  .map((ms) => new Date(ms).toISOString())

// Base category generator
const categoryArb: fc.Arbitrary<Category> = fc.record({
  label: categoryLabelArb,
  icon: categoryIconArb,
  color: categoryColorArb,
  order: fc.nat({ max: 100 }),
  isDefault: fc.boolean(),
  updatedAt: isoDateStringArb,
})

// Generate array of categories with unique labels
const uniqueCategoriesArb = (minLength: number, maxLength: number) =>
  fc.array(categoryArb, { minLength, maxLength }).map((categories) => {
    // Ensure unique labels by appending index
    const seen = new Set<string>()
    return categories.map((c, i) => {
      let label = c.label
      while (seen.has(label.toLowerCase())) {
        label = `${c.label}${i}`
      }
      seen.add(label.toLowerCase())
      return { ...c, label, order: i }
    })
  })

describe("CategoryMerger Properties", () => {
  /**
   * Property 14: Category Merge Completeness
   * For any local category list and remote category list:
   * - Categories existing only locally SHALL appear in the merged result
   * - Categories existing only remotely SHALL appear in the merged result
   * - Categories existing in both SHALL appear exactly once in the merged result
   */
  describe("Property 14: Category Merge Completeness", () => {
    it("categories existing only locally SHALL appear in the merged result", () => {
      fc.assert(
        fc.property(uniqueCategoriesArb(1, 5), (localCategories) => {
          const result = mergeCategories(localCategories, [])

          // All local categories should be in merged result
          return localCategories.every((local) =>
            result.merged.some((m) => m.label.toLowerCase() === local.label.toLowerCase())
          )
        }),
        { numRuns: 100 }
      )
    })

    it("categories existing only remotely SHALL appear in the merged result", () => {
      fc.assert(
        fc.property(uniqueCategoriesArb(1, 5), (remoteCategories) => {
          const result = mergeCategories([], remoteCategories)

          // All remote categories should be in merged result
          return remoteCategories.every((remote) =>
            result.merged.some(
              (m) => m.label.toLowerCase() === remote.label.toLowerCase()
            )
          )
        }),
        { numRuns: 100 }
      )
    })

    it("categories existing in both SHALL appear exactly once in the merged result", () => {
      fc.assert(
        fc.property(
          uniqueCategoriesArb(1, 5),
          uniqueCategoriesArb(1, 5),
          (localCategories, remoteCategories) => {
            const result = mergeCategories(localCategories, remoteCategories)

            // Each label should appear exactly once
            const labels = result.merged.map((c) => c.label.toLowerCase())
            const uniqueLabels = new Set(labels)

            return labels.length === uniqueLabels.size
          }
        ),
        { numRuns: 100 }
      )
    })

    it("merge result SHALL contain all unique labels from both local and remote", () => {
      fc.assert(
        fc.property(
          uniqueCategoriesArb(0, 5),
          uniqueCategoriesArb(0, 5),
          (localCategories, remoteCategories) => {
            // Remap remote labels to avoid overlap for this test
            const remoteWithUniqueLabels = remoteCategories.map((c, i) => ({
              ...c,
              label: `Remote${c.label}${i}`,
            }))

            const result = mergeCategories(localCategories, remoteWithUniqueLabels)

            // Get all unique labels from both sets (case-insensitive)
            const allLabels = new Set([
              ...localCategories.map((c) => c.label.toLowerCase()),
              ...remoteWithUniqueLabels.map((c) => c.label.toLowerCase()),
            ])

            // Merged result should contain all labels (plus possibly "Other" if not present)
            const mergedLabels = new Set(result.merged.map((c) => c.label.toLowerCase()))

            for (const label of allLabels) {
              if (!mergedLabels.has(label)) {
                return false
              }
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("local-only categories SHALL be tracked in addedFromLocal", () => {
      fc.assert(
        fc.property(uniqueCategoriesArb(1, 5), (localCategories) => {
          const result = mergeCategories(localCategories, [])

          // All local categories should be in addedFromLocal
          return localCategories.every((local) =>
            result.addedFromLocal.some(
              (label) => label.toLowerCase() === local.label.toLowerCase()
            )
          )
        }),
        { numRuns: 100 }
      )
    })

    it("remote-only categories SHALL be tracked in addedFromRemote", () => {
      fc.assert(
        fc.property(uniqueCategoriesArb(1, 5), (remoteCategories) => {
          const result = mergeCategories([], remoteCategories)

          // All remote categories should be in addedFromRemote
          return remoteCategories.every((remote) =>
            result.addedFromRemote.some(
              (label) => label.toLowerCase() === remote.label.toLowerCase()
            )
          )
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 15: Category Merge Conflict Resolution
   * For any category label existing in both local and remote with different properties,
   * the merged result SHALL contain the version with the more recent updatedAt timestamp.
   */
  describe("Property 15: Category Merge Conflict Resolution", () => {
    it("newer remote version SHALL win when timestamps differ", () => {
      fc.assert(
        fc.property(
          categoryArb,
          categoryIconArb,
          categoryColorArb,
          (baseCategory, newIcon, newColor) => {
            const baseTime = new Date(baseCategory.updatedAt).getTime()

            // Local is older
            const localCategory: Category = {
              ...baseCategory,
              label: "TestCategory",
              updatedAt: new Date(baseTime).toISOString(),
            }

            // Remote is newer with different properties
            const remoteCategory: Category = {
              ...baseCategory,
              label: "TestCategory",
              icon: newIcon,
              color: newColor,
              updatedAt: new Date(baseTime + 10000).toISOString(),
            }

            const result = mergeCategories([localCategory], [remoteCategory])

            // Remote should win
            const merged = result.merged.find(
              (c) => c.label.toLowerCase() === "testcategory"
            )
            if (!merged) return false

            // If properties are different, remote should win
            if (localCategory.icon !== remoteCategory.icon) {
              return merged.icon === remoteCategory.icon
            }
            if (localCategory.color !== remoteCategory.color) {
              return merged.color === remoteCategory.color
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("newer local version SHALL win when timestamps differ", () => {
      fc.assert(
        fc.property(
          categoryArb,
          categoryIconArb,
          categoryColorArb,
          (baseCategory, newIcon, newColor) => {
            const baseTime = new Date(baseCategory.updatedAt).getTime()

            // Local is newer with different properties
            const localCategory: Category = {
              ...baseCategory,
              label: "TestCategory",
              icon: newIcon,
              color: newColor,
              updatedAt: new Date(baseTime + 10000).toISOString(),
            }

            // Remote is older
            const remoteCategory: Category = {
              ...baseCategory,
              label: "TestCategory",
              updatedAt: new Date(baseTime).toISOString(),
            }

            const result = mergeCategories([localCategory], [remoteCategory])

            // Local should win
            const merged = result.merged.find(
              (c) => c.label.toLowerCase() === "testcategory"
            )
            if (!merged) return false

            // If properties are different, local should win
            if (localCategory.icon !== remoteCategory.icon) {
              return merged.icon === localCategory.icon
            }
            if (localCategory.color !== remoteCategory.color) {
              return merged.color === localCategory.color
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("conflicts SHALL be tracked when both versions have different content", () => {
      fc.assert(
        fc.property(categoryArb, categoryIconArb, (baseCategory, differentIcon) => {
          const baseTime = new Date(baseCategory.updatedAt).getTime()

          // Ensure icons are different
          const localIcon = baseCategory.icon
          const remoteIcon = differentIcon !== localIcon ? differentIcon : "Star"

          const localCategory: Category = {
            ...baseCategory,
            label: "TestCategory",
            icon: localIcon,
            updatedAt: new Date(baseTime).toISOString(),
          }

          const remoteCategory: Category = {
            ...baseCategory,
            label: "TestCategory",
            icon: remoteIcon,
            updatedAt: new Date(baseTime + 10000).toISOString(),
          }

          // Only test when icons are actually different
          if (localIcon === remoteIcon) {
            return true // Skip - identical content
          }

          const result = mergeCategories([localCategory], [remoteCategory])

          // Should be tracked as conflict
          return result.conflicts.some((label) => label.toLowerCase() === "testcategory")
        }),
        { numRuns: 100 }
      )
    })

    it("equal timestamps with different content SHALL use local version", () => {
      fc.assert(
        fc.property(categoryArb, categoryIconArb, (baseCategory, differentIcon) => {
          const sameTimestamp = new Date().toISOString()

          // Ensure icons are different
          const localIcon = baseCategory.icon
          const remoteIcon = differentIcon !== localIcon ? differentIcon : "Star"

          const localCategory: Category = {
            ...baseCategory,
            label: "TestCategory",
            icon: localIcon,
            updatedAt: sameTimestamp,
          }

          const remoteCategory: Category = {
            ...baseCategory,
            label: "TestCategory",
            icon: remoteIcon,
            updatedAt: sameTimestamp,
          }

          // Only test when icons are actually different
          if (localIcon === remoteIcon) {
            return true // Skip - identical content
          }

          const result = mergeCategories([localCategory], [remoteCategory])

          // Local should win when timestamps are equal
          const merged = result.merged.find(
            (c) => c.label.toLowerCase() === "testcategory"
          )
          return merged !== undefined && merged.icon === localIcon
        }),
        { numRuns: 100 }
      )
    })
  })

  describe("Other Category Guarantee", () => {
    it("merged result SHALL always contain 'Other' category", () => {
      fc.assert(
        fc.property(
          uniqueCategoriesArb(0, 5),
          uniqueCategoriesArb(0, 5),
          (localCategories, remoteCategories) => {
            // Filter out any "Other" categories to test the guarantee
            const localWithoutOther = localCategories.filter(
              (c) => c.label.toLowerCase() !== "other"
            )
            const remoteWithoutOther = remoteCategories.filter(
              (c) => c.label.toLowerCase() !== "other"
            )

            const result = mergeCategories(localWithoutOther, remoteWithoutOther)

            // Should always have "Other" category
            return result.merged.some((c) => c.label.toLowerCase() === "other")
          }
        ),
        { numRuns: 100 }
      )
    })

    it("existing 'Other' category SHALL be preserved in merge", () => {
      fc.assert(
        fc.property(categoryArb, (baseCategory) => {
          const otherCategory: Category = {
            ...baseCategory,
            label: "Other",
            icon: "Circle",
            color: "#C4B7C9",
          }

          const result = mergeCategories([otherCategory], [])

          // Should have exactly one "Other" category
          const otherCategories = result.merged.filter(
            (c) => c.label.toLowerCase() === "other"
          )
          return otherCategories.length === 1
        }),
        { numRuns: 100 }
      )
    })
  })

  describe("Order Preservation", () => {
    it("merged categories SHALL have sequential order values", () => {
      fc.assert(
        fc.property(
          uniqueCategoriesArb(1, 5),
          uniqueCategoriesArb(1, 5),
          (localCategories, remoteCategories) => {
            const result = mergeCategories(localCategories, remoteCategories)

            // Order values should be sequential starting from 0
            const orders = result.merged.map((c) => c.order).sort((a, b) => a - b)
            return orders.every((order, index) => order === index)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("merged categories SHALL be sorted by order", () => {
      fc.assert(
        fc.property(
          uniqueCategoriesArb(1, 5),
          uniqueCategoriesArb(1, 5),
          (localCategories, remoteCategories) => {
            const result = mergeCategories(localCategories, remoteCategories)

            // Categories should be sorted by order
            for (let i = 1; i < result.merged.length; i++) {
              if (result.merged[i].order < result.merged[i - 1].order) {
                return false
              }
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Label Uniqueness", () => {
    it("merged result SHALL have unique labels (case-insensitive)", () => {
      fc.assert(
        fc.property(
          uniqueCategoriesArb(0, 5),
          uniqueCategoriesArb(0, 5),
          (localCategories, remoteCategories) => {
            const result = mergeCategories(localCategories, remoteCategories)

            const labels = result.merged.map((c) => c.label.toLowerCase())
            const uniqueLabels = new Set(labels)

            return labels.length === uniqueLabels.size
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
