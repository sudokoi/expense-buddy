/**
 * Property-based tests for Category Validation
 * Feature: custom-categories
 */

import fc from "fast-check"
import {
  validateCategoryForm,
  categoryLabelSchema,
  isValidCategoryLabel,
} from "./category-validation"

// Generator for valid category labels (1-30 chars with at least one alphanumeric)
const validLabelArb = fc
  .tuple(
    // At least one alphanumeric character
    fc.constantFrom(
      ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("")
    ),
    // Rest can be any printable characters (0-29 more chars)
    fc.string({ minLength: 0, maxLength: 29 })
  )
  .map(([required, rest]) => {
    // Insert the required alphanumeric at a random position
    const combined = required + rest
    return combined.slice(0, 30) // Ensure max 30 chars
  })
  .filter((s) => s.trim().length > 0 && /[a-zA-Z0-9]/.test(s))

// Generator for whitespace-only strings
const whitespaceOnlyArb = fc
  .array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 1, maxLength: 10 })
  .map((chars) => chars.join(""))

// Generator for strings with no alphanumeric characters
const noAlphanumericArb = fc
  .array(fc.constantFrom(..."!@#$%^&*()-_=+[]{}|;:',.<>?/`~".split("")), {
    minLength: 1,
    maxLength: 10,
  })
  .map((chars) => chars.join(""))

// Generator for strings longer than 30 characters
const tooLongLabelArb = fc.string({ minLength: 31, maxLength: 50 })

// Generator for valid hex colors
const validColorArb = fc
  .array(fc.constantFrom(..."0123456789ABCDEFabcdef".split("")), {
    minLength: 6,
    maxLength: 6,
  })
  .map((chars) => `#${chars.join("")}`)

// Generator for valid icon names (non-empty strings)
const validIconArb = fc.constantFrom(
  "Utensils",
  "Car",
  "ShoppingCart",
  "Home",
  "Activity",
  "Film",
  "Circle",
  "Star"
)

describe("Category Validation Properties", () => {
  /**
   * Property 3: Label Validation Correctness
   * For any string input as a category label:
   * - If the string is empty or contains only whitespace, validation SHALL fail
   * - If the string length exceeds 30 characters, validation SHALL fail
   * - If the string contains no alphanumeric characters, validation SHALL fail
   * - If the string is 1-30 characters with at least one alphanumeric character, validation SHALL pass
   */
  describe("Property 3: Label Validation Correctness", () => {
    it("empty strings SHALL fail validation", () => {
      fc.assert(
        fc.property(fc.constant(""), (label) => {
          const result = categoryLabelSchema.safeParse(label)
          return result.success === false
        }),
        { numRuns: 100 }
      )
    })

    it("whitespace-only strings SHALL fail validation", () => {
      fc.assert(
        fc.property(whitespaceOnlyArb, (label) => {
          const result = categoryLabelSchema.safeParse(label)
          return result.success === false
        }),
        { numRuns: 100 }
      )
    })

    it("strings exceeding 30 characters SHALL fail validation", () => {
      fc.assert(
        fc.property(tooLongLabelArb, (label) => {
          const result = categoryLabelSchema.safeParse(label)
          return result.success === false
        }),
        { numRuns: 100 }
      )
    })

    it("strings with no alphanumeric characters SHALL fail validation", () => {
      fc.assert(
        fc.property(noAlphanumericArb, (label) => {
          const result = categoryLabelSchema.safeParse(label)
          return result.success === false
        }),
        { numRuns: 100 }
      )
    })

    it("valid labels (1-30 chars with alphanumeric) SHALL pass validation", () => {
      fc.assert(
        fc.property(validLabelArb, (label) => {
          const result = categoryLabelSchema.safeParse(label)
          return result.success === true
        }),
        { numRuns: 100 }
      )
    })

    it("isValidCategoryLabel helper SHALL match schema validation", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 40 }), (label) => {
          const schemaResult = categoryLabelSchema.safeParse(label).success
          const helperResult = isValidCategoryLabel(label)
          return schemaResult === helperResult
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 5: Duplicate Label Rejection
   * For any existing category list and any new label that matches (case-insensitive)
   * an existing category's label, the add operation SHALL fail with a validation error.
   */
  describe("Property 5: Duplicate Label Rejection", () => {
    it("duplicate labels (case-insensitive) SHALL be rejected", () => {
      fc.assert(
        fc.property(validLabelArb, validIconArb, validColorArb, (label, icon, color) => {
          // Normalize the label (trim) to match validation behavior
          const normalizedLabel = label.trim()
          // Create existing labels with the same normalized label
          const existingLabels = [normalizedLabel, "Other", "Food"]
          // Try to add with different case - should be rejected as duplicate
          const result = validateCategoryForm(
            { label: normalizedLabel.toLowerCase(), icon, color },
            existingLabels
          )
          // Should fail due to duplicate (case-insensitive match)
          return result.success === false && result.errors["label"] !== undefined
        }),
        { numRuns: 100 }
      )
    })

    it("unique labels SHALL be accepted", () => {
      fc.assert(
        fc.property(validLabelArb, validIconArb, validColorArb, (label, icon, color) => {
          // Ensure the label is not in existing labels
          const existingLabels = ["Food", "Transport", "Other"].filter(
            (l) => l.toLowerCase() !== label.toLowerCase()
          )
          const result = validateCategoryForm({ label, icon, color }, existingLabels)
          return result.success === true
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 7: Edit Uniqueness Self-Exclusion
   * For any category being edited, changing its label to its current value SHALL NOT
   * trigger a duplicate validation error, but changing it to another existing category's
   * label SHALL trigger an error.
   */
  describe("Property 7: Edit Uniqueness Self-Exclusion", () => {
    it("editing a label to its current value SHALL NOT trigger duplicate error", () => {
      fc.assert(
        fc.property(validLabelArb, validIconArb, validColorArb, (label, icon, color) => {
          const existingLabels = [label, "Other", "Food"]
          // Pass currentLabel to exclude self from duplicate check
          const result = validateCategoryForm(
            { label, icon, color },
            existingLabels,
            label
          )
          return result.success === true
        }),
        { numRuns: 100 }
      )
    })

    it("editing a label to another existing label SHALL trigger duplicate error", () => {
      fc.assert(
        fc.property(validLabelArb, validIconArb, validColorArb, (label, icon, color) => {
          const targetLabel = "Food"
          // Skip if the generated label happens to be "Food"
          if (label.toLowerCase() === targetLabel.toLowerCase()) return true

          const existingLabels = [label, targetLabel, "Other"]
          // Try to change to "Food" while editing the generated label
          const result = validateCategoryForm(
            { label: targetLabel, icon, color },
            existingLabels,
            label
          )
          return result.success === false && result.errors["label"] !== undefined
        }),
        { numRuns: 100 }
      )
    })
  })
})
