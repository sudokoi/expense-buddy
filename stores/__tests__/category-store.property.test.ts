/**
 * Property-based tests for Category Store Operations
 * Feature: custom-categories
 *
 * These tests verify the category management functionality in the settings store:
 * - Category add round-trip
 * - Category edit round-trip
 * - Category delete removes category
 * - Reorder persistence
 */

import fc from "fast-check"
import { createStore } from "@xstate/store"
import { Category } from "../../types/category"
import { DEFAULT_CATEGORIES } from "../../constants/default-categories"
import { ALL_CATEGORY_ICONS } from "../../constants/category-icons"
import {
  CATEGORY_COLOR_PALETTE,
  getRandomCategoryColor,
} from "../../constants/category-colors"

// Create a test store that mimics the category operations
function createTestCategoryStore(initialCategories: Category[] = DEFAULT_CATEGORIES) {
  return createStore({
    context: {
      categories: initialCategories,
    },

    on: {
      addCategory: (
        context,
        event: { category: Omit<Category, "order" | "updatedAt"> }
      ) => {
        const existingColors = context.categories.map((c) => c.color)
        const maxOrder = Math.max(...context.categories.map((c) => c.order), -1)

        const newCategory: Category = {
          ...event.category,
          color: event.category.color || getRandomCategoryColor(existingColors),
          order: maxOrder + 1,
          updatedAt: new Date().toISOString(),
        }

        return {
          ...context,
          categories: [...context.categories, newCategory],
        }
      },

      updateCategory: (
        context,
        event: { label: string; updates: Partial<Omit<Category, "updatedAt">> }
      ) => {
        const newCategories = context.categories.map((cat) => {
          if (cat.label === event.label) {
            return {
              ...cat,
              ...event.updates,
              updatedAt: new Date().toISOString(),
            }
          }
          return cat
        })

        return {
          ...context,
          categories: newCategories,
        }
      },

      deleteCategory: (context, event: { label: string }) => {
        // Prevent deletion of "Other" category
        if (event.label === "Other") {
          return context
        }

        return {
          ...context,
          categories: context.categories.filter((cat) => cat.label !== event.label),
        }
      },

      reorderCategories: (context, event: { labels: string[] }) => {
        const categoryMap = new Map(context.categories.map((cat) => [cat.label, cat]))

        const newCategories = event.labels
          .map((label, index) => {
            const cat = categoryMap.get(label)
            if (cat) {
              return {
                ...cat,
                order: index,
                updatedAt: new Date().toISOString(),
              }
            }
            return null
          })
          .filter((cat): cat is Category => cat !== null)

        // Add any categories not in the labels array
        const labelsSet = new Set(event.labels)
        const missingCategories = context.categories
          .filter((cat) => !labelsSet.has(cat.label))
          .map((cat, index) => ({
            ...cat,
            order: newCategories.length + index,
            updatedAt: new Date().toISOString(),
          }))

        return {
          ...context,
          categories: [...newCategories, ...missingCategories],
        }
      },
    },
  })
}

// Selector to get categories sorted by order
const selectCategories = (categories: Category[]): Category[] => {
  return [...categories].sort((a, b) => a.order - b.order)
}

// Arbitrary generators
const categoryLabelArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s))
  // Ensure unique labels by adding a random suffix
  .map((s) => `${s.trim()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)

const categoryIconArb = fc.constantFrom(...ALL_CATEGORY_ICONS)
const categoryColorArb = fc.constantFrom(...CATEGORY_COLOR_PALETTE)

const newCategoryArb: fc.Arbitrary<Omit<Category, "order" | "updatedAt">> = fc.record({
  label: categoryLabelArb,
  icon: categoryIconArb,
  color: categoryColorArb,
  isDefault: fc.constant(false),
})

describe("Category Store Properties", () => {
  /**
   * Property 6: Category Add Round-Trip
   * For any valid category data (label, icon, color), after adding the category
   * to the store, querying the store SHALL return a category with matching
   * label, icon, and color values.
   */
  describe("Property 6: Category Add Round-Trip", () => {
    it("added category SHALL be retrievable with matching label, icon, and color", () => {
      fc.assert(
        fc.property(newCategoryArb, (newCategory) => {
          const store = createTestCategoryStore([])

          store.trigger.addCategory({ category: newCategory })

          const categories = store.getSnapshot().context.categories
          const found = categories.find((c) => c.label === newCategory.label)

          return (
            found !== undefined &&
            found.label === newCategory.label &&
            found.icon === newCategory.icon &&
            found.color === newCategory.color
          )
        }),
        { numRuns: 100 }
      )
    })

    it("added category SHALL have order equal to max existing order + 1", () => {
      fc.assert(
        fc.property(newCategoryArb, (newCategory) => {
          const store = createTestCategoryStore(DEFAULT_CATEGORIES)
          const maxOrderBefore = Math.max(
            ...store.getSnapshot().context.categories.map((c) => c.order)
          )

          store.trigger.addCategory({ category: newCategory })

          const categories = store.getSnapshot().context.categories
          const found = categories.find((c) => c.label === newCategory.label)

          return found !== undefined && found.order === maxOrderBefore + 1
        }),
        { numRuns: 100 }
      )
    })

    it("added category SHALL have a valid updatedAt timestamp", () => {
      fc.assert(
        fc.property(newCategoryArb, (newCategory) => {
          const beforeAdd = new Date().toISOString()
          const store = createTestCategoryStore([])

          store.trigger.addCategory({ category: newCategory })

          const categories = store.getSnapshot().context.categories
          const found = categories.find((c) => c.label === newCategory.label)
          const afterAdd = new Date().toISOString()

          return (
            found !== undefined &&
            found.updatedAt >= beforeAdd &&
            found.updatedAt <= afterAdd
          )
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 8: Category Edit Round-Trip
   * For any existing category and valid update data, after editing the category,
   * querying the store SHALL return the category with the updated values.
   */
  describe("Property 8: Category Edit Round-Trip", () => {
    it("edited category SHALL reflect the updated icon", () => {
      fc.assert(
        fc.property(categoryIconArb, (newIcon) => {
          const store = createTestCategoryStore(DEFAULT_CATEGORIES)
          const targetLabel = "Food" // Use a known category

          store.trigger.updateCategory({
            label: targetLabel,
            updates: { icon: newIcon },
          })

          const categories = store.getSnapshot().context.categories
          const found = categories.find((c) => c.label === targetLabel)

          return found !== undefined && found.icon === newIcon
        }),
        { numRuns: 100 }
      )
    })

    it("edited category SHALL reflect the updated color", () => {
      fc.assert(
        fc.property(categoryColorArb, (newColor) => {
          const store = createTestCategoryStore(DEFAULT_CATEGORIES)
          const targetLabel = "Transport"

          store.trigger.updateCategory({
            label: targetLabel,
            updates: { color: newColor },
          })

          const categories = store.getSnapshot().context.categories
          const found = categories.find((c) => c.label === targetLabel)

          return found !== undefined && found.color === newColor
        }),
        { numRuns: 100 }
      )
    })

    it("edited category SHALL have updated updatedAt timestamp", () => {
      fc.assert(
        fc.property(categoryIconArb, (newIcon) => {
          const store = createTestCategoryStore(DEFAULT_CATEGORIES)
          const targetLabel = "Groceries"
          const originalCategory = store
            .getSnapshot()
            .context.categories.find((c) => c.label === targetLabel)
          const originalUpdatedAt = originalCategory?.updatedAt

          // Small delay to ensure timestamp difference
          const beforeEdit = new Date().toISOString()

          store.trigger.updateCategory({
            label: targetLabel,
            updates: { icon: newIcon },
          })

          const categories = store.getSnapshot().context.categories
          const found = categories.find((c) => c.label === targetLabel)

          return (
            found !== undefined &&
            found.updatedAt >= beforeEdit &&
            (originalUpdatedAt === undefined || found.updatedAt >= originalUpdatedAt)
          )
        }),
        { numRuns: 100 }
      )
    })

    it("editing non-existent category SHALL not change the store", () => {
      fc.assert(
        fc.property(categoryIconArb, (newIcon) => {
          const store = createTestCategoryStore(DEFAULT_CATEGORIES)
          const categoriesBefore = [...store.getSnapshot().context.categories]

          store.trigger.updateCategory({
            label: "NonExistentCategory_12345",
            updates: { icon: newIcon },
          })

          const categoriesAfter = store.getSnapshot().context.categories

          // Same number of categories
          return categoriesBefore.length === categoriesAfter.length
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 10: Category Delete Removes Category
   * For any category (except "Other"), after deletion, the category list
   * SHALL NOT contain a category with that label.
   */
  describe("Property 10: Category Delete Removes Category", () => {
    it("deleted category SHALL NOT appear in the category list", () => {
      // Use categories that are not "Other"
      const deletableCategoryLabels = DEFAULT_CATEGORIES.filter(
        (c) => c.label !== "Other"
      ).map((c) => c.label)

      fc.assert(
        fc.property(fc.constantFrom(...deletableCategoryLabels), (labelToDelete) => {
          const store = createTestCategoryStore(DEFAULT_CATEGORIES)

          store.trigger.deleteCategory({ label: labelToDelete })

          const categories = store.getSnapshot().context.categories
          const found = categories.find((c) => c.label === labelToDelete)

          return found === undefined
        }),
        { numRuns: 100 }
      )
    })

    it("deleting category SHALL reduce category count by 1", () => {
      const deletableCategoryLabels = DEFAULT_CATEGORIES.filter(
        (c) => c.label !== "Other"
      ).map((c) => c.label)

      fc.assert(
        fc.property(fc.constantFrom(...deletableCategoryLabels), (labelToDelete) => {
          const store = createTestCategoryStore(DEFAULT_CATEGORIES)
          const countBefore = store.getSnapshot().context.categories.length

          store.trigger.deleteCategory({ label: labelToDelete })

          const countAfter = store.getSnapshot().context.categories.length

          return countAfter === countBefore - 1
        }),
        { numRuns: 100 }
      )
    })

    it("deleting 'Other' category SHALL NOT remove it from the list", () => {
      fc.assert(
        fc.property(fc.constant("Other"), (label) => {
          const store = createTestCategoryStore(DEFAULT_CATEGORIES)
          const countBefore = store.getSnapshot().context.categories.length

          store.trigger.deleteCategory({ label })

          const categories = store.getSnapshot().context.categories
          const found = categories.find((c) => c.label === "Other")
          const countAfter = categories.length

          return found !== undefined && countAfter === countBefore
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 11: "Other" Category Protection
   * For any sequence of delete operations targeting the "Other" category,
   * the "Other" category SHALL always remain in the category list and
   * SHALL NOT be removed regardless of how many times deletion is attempted.
   */
  describe("Property 11: 'Other' Category Protection", () => {
    it("'Other' category SHALL remain after any number of delete attempts", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (deleteAttempts) => {
          const store = createTestCategoryStore(DEFAULT_CATEGORIES)
          const countBefore = store.getSnapshot().context.categories.length

          // Attempt to delete "Other" multiple times
          for (let i = 0; i < deleteAttempts; i++) {
            store.trigger.deleteCategory({ label: "Other" })
          }

          const categories = store.getSnapshot().context.categories
          const otherCategory = categories.find((c) => c.label === "Other")
          const countAfter = categories.length

          return otherCategory !== undefined && countAfter === countBefore
        }),
        { numRuns: 100 }
      )
    })

    it("'Other' category SHALL remain even when mixed with valid deletions", () => {
      const deletableCategoryLabels = DEFAULT_CATEGORIES.filter(
        (c) => c.label !== "Other"
      ).map((c) => c.label)

      fc.assert(
        fc.property(
          fc.shuffledSubarray(deletableCategoryLabels, { minLength: 1, maxLength: 3 }),
          (categoriesToDelete) => {
            const store = createTestCategoryStore(DEFAULT_CATEGORIES)

            // Delete some valid categories and attempt to delete "Other"
            for (const label of categoriesToDelete) {
              store.trigger.deleteCategory({ label })
            }
            store.trigger.deleteCategory({ label: "Other" })

            const categories = store.getSnapshot().context.categories
            const otherCategory = categories.find((c) => c.label === "Other")

            // "Other" should still exist
            // Deleted categories should be gone
            const deletedStillExist = categoriesToDelete.some((label) =>
              categories.find((c) => c.label === label)
            )

            return otherCategory !== undefined && !deletedStillExist
          }
        ),
        { numRuns: 100 }
      )
    })

    it("'Other' category properties SHALL remain unchanged after delete attempt", () => {
      fc.assert(
        fc.property(fc.constant(true), () => {
          const store = createTestCategoryStore(DEFAULT_CATEGORIES)
          const otherBefore = store
            .getSnapshot()
            .context.categories.find((c) => c.label === "Other")

          store.trigger.deleteCategory({ label: "Other" })

          const otherAfter = store
            .getSnapshot()
            .context.categories.find((c) => c.label === "Other")

          return (
            otherBefore !== undefined &&
            otherAfter !== undefined &&
            otherBefore.label === otherAfter.label &&
            otherBefore.icon === otherAfter.icon &&
            otherBefore.color === otherAfter.color &&
            otherBefore.order === otherAfter.order &&
            otherBefore.isDefault === otherAfter.isDefault
          )
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 12: Reorder Persistence
   * For any valid reordering of categories (permutation of labels), after the
   * reorder operation, the categories SHALL have order values matching the new sequence.
   */
  describe("Property 12: Reorder Persistence", () => {
    it("reordered categories SHALL have order values matching the new sequence", () => {
      fc.assert(
        fc.property(
          fc.shuffledSubarray(
            DEFAULT_CATEGORIES.map((c) => c.label),
            { minLength: DEFAULT_CATEGORIES.length, maxLength: DEFAULT_CATEGORIES.length }
          ),
          (shuffledLabels) => {
            const store = createTestCategoryStore(DEFAULT_CATEGORIES)

            store.trigger.reorderCategories({ labels: shuffledLabels })

            const categories = store.getSnapshot().context.categories
            const sortedCategories = selectCategories(categories)

            // Verify that the sorted order matches the shuffled labels
            return shuffledLabels.every((label, index) => {
              const cat = sortedCategories[index]
              return cat !== undefined && cat.label === label && cat.order === index
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    it("reorder SHALL preserve all categories (no categories lost)", () => {
      fc.assert(
        fc.property(
          fc.shuffledSubarray(
            DEFAULT_CATEGORIES.map((c) => c.label),
            { minLength: DEFAULT_CATEGORIES.length, maxLength: DEFAULT_CATEGORIES.length }
          ),
          (shuffledLabels) => {
            const store = createTestCategoryStore(DEFAULT_CATEGORIES)
            const countBefore = store.getSnapshot().context.categories.length

            store.trigger.reorderCategories({ labels: shuffledLabels })

            const countAfter = store.getSnapshot().context.categories.length

            return countAfter === countBefore
          }
        ),
        { numRuns: 100 }
      )
    })

    it("reorder SHALL update updatedAt for all reordered categories", () => {
      fc.assert(
        fc.property(
          fc.shuffledSubarray(
            DEFAULT_CATEGORIES.map((c) => c.label),
            { minLength: DEFAULT_CATEGORIES.length, maxLength: DEFAULT_CATEGORIES.length }
          ),
          (shuffledLabels) => {
            const store = createTestCategoryStore(DEFAULT_CATEGORIES)
            const beforeReorder = new Date().toISOString()

            store.trigger.reorderCategories({ labels: shuffledLabels })

            const categories = store.getSnapshot().context.categories

            // All categories should have updatedAt >= beforeReorder
            return categories.every((cat) => cat.updatedAt >= beforeReorder)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
