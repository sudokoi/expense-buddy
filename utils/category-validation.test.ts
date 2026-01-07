/**
 * Unit tests for Category Validation
 * Tests boundary conditions, edge cases, and specific validation scenarios
 */

import {
  validateCategoryForm,
  categoryLabelSchema,
  isValidCategoryLabel,
  isValidCategoryIcon,
  isValidCategoryColor,
  isColorFromPalette,
} from "./category-validation"

describe("Category Validation", () => {
  describe("Label Validation - Boundary Conditions", () => {
    it("should accept exactly 1 character label with alphanumeric", () => {
      const result = categoryLabelSchema.safeParse("A")
      expect(result.success).toBe(true)
    })

    it("should accept exactly 30 character label", () => {
      const label = "A".repeat(30)
      const result = categoryLabelSchema.safeParse(label)
      expect(result.success).toBe(true)
    })

    it("should reject 31 character label", () => {
      const label = "A".repeat(31)
      const result = categoryLabelSchema.safeParse(label)
      expect(result.success).toBe(false)
    })

    it("should reject empty string", () => {
      const result = categoryLabelSchema.safeParse("")
      expect(result.success).toBe(false)
    })
  })

  describe("Label Validation - Mixed Characters", () => {
    it("should accept label with letters and numbers", () => {
      const result = categoryLabelSchema.safeParse("Food2Go")
      expect(result.success).toBe(true)
    })

    it("should accept label with special characters if alphanumeric present", () => {
      const result = categoryLabelSchema.safeParse("Food & Drink!")
      expect(result.success).toBe(true)
    })

    it("should accept label with unicode and alphanumeric", () => {
      const result = categoryLabelSchema.safeParse("Café 1")
      expect(result.success).toBe(true)
    })

    it("should reject label with only special characters", () => {
      const result = categoryLabelSchema.safeParse("!@#$%")
      expect(result.success).toBe(false)
    })

    it("should reject label with only spaces", () => {
      const result = categoryLabelSchema.safeParse("     ")
      expect(result.success).toBe(false)
    })

    it("should accept label with leading/trailing spaces if alphanumeric present", () => {
      const result = categoryLabelSchema.safeParse("  Food  ")
      expect(result.success).toBe(true)
    })
  })

  describe("Duplicate Detection - Case Insensitive", () => {
    const existingLabels = ["Food", "Transport", "Other"]

    it("should reject exact duplicate", () => {
      const result = validateCategoryForm(
        { label: "Food", icon: "Utensils", color: "#FFB07C" },
        existingLabels
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors["label"]).toBe("A category with this name already exists")
      }
    })

    it("should reject lowercase duplicate", () => {
      const result = validateCategoryForm(
        { label: "food", icon: "Utensils", color: "#FFB07C" },
        existingLabels
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors["label"]).toBe("A category with this name already exists")
      }
    })

    it("should reject uppercase duplicate", () => {
      const result = validateCategoryForm(
        { label: "FOOD", icon: "Utensils", color: "#FFB07C" },
        existingLabels
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors["label"]).toBe("A category with this name already exists")
      }
    })

    it("should reject mixed case duplicate", () => {
      const result = validateCategoryForm(
        { label: "FoOd", icon: "Utensils", color: "#FFB07C" },
        existingLabels
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors["label"]).toBe("A category with this name already exists")
      }
    })

    it("should accept unique label", () => {
      const result = validateCategoryForm(
        { label: "Shopping", icon: "ShoppingCart", color: "#7FDBCA" },
        existingLabels
      )
      expect(result.success).toBe(true)
    })
  })

  describe("Edit Mode - Self Exclusion", () => {
    const existingLabels = ["Food", "Transport", "Other"]

    it("should allow keeping the same label when editing", () => {
      const result = validateCategoryForm(
        { label: "Food", icon: "Utensils", color: "#FFB07C" },
        existingLabels,
        "Food" // currentLabel - editing Food
      )
      expect(result.success).toBe(true)
    })

    it("should allow changing case of own label when editing", () => {
      const result = validateCategoryForm(
        { label: "FOOD", icon: "Utensils", color: "#FFB07C" },
        existingLabels,
        "Food" // currentLabel - editing Food
      )
      expect(result.success).toBe(true)
    })

    it("should reject changing to another existing label when editing", () => {
      const result = validateCategoryForm(
        { label: "Transport", icon: "Utensils", color: "#FFB07C" },
        existingLabels,
        "Food" // currentLabel - editing Food, trying to change to Transport
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors["label"]).toBe("A category with this name already exists")
      }
    })
  })

  describe("Full Form Validation", () => {
    it("should validate complete valid form", () => {
      const result = validateCategoryForm(
        { label: "Shopping", icon: "ShoppingCart", color: "#7FDBCA" },
        ["Food", "Other"]
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.label).toBe("Shopping")
        expect(result.data.icon).toBe("ShoppingCart")
        expect(result.data.color).toBe("#7FDBCA")
      }
    })

    it("should reject form with empty icon", () => {
      const result = validateCategoryForm(
        { label: "Shopping", icon: "", color: "#7FDBCA" },
        []
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors["icon"]).toBeDefined()
      }
    })

    it("should reject form with invalid color format", () => {
      const result = validateCategoryForm(
        { label: "Shopping", icon: "ShoppingCart", color: "red" },
        []
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors["color"]).toBeDefined()
      }
    })

    it("should accept lowercase hex color", () => {
      const result = validateCategoryForm(
        { label: "Shopping", icon: "ShoppingCart", color: "#abcdef" },
        []
      )
      expect(result.success).toBe(true)
    })

    it("should accept uppercase hex color", () => {
      const result = validateCategoryForm(
        { label: "Shopping", icon: "ShoppingCart", color: "#ABCDEF" },
        []
      )
      expect(result.success).toBe(true)
    })
  })

  describe("Helper Functions", () => {
    describe("isValidCategoryLabel", () => {
      it("should return true for valid labels", () => {
        expect(isValidCategoryLabel("Food")).toBe(true)
        expect(isValidCategoryLabel("A")).toBe(true)
        expect(isValidCategoryLabel("Food & Drink")).toBe(true)
      })

      it("should return false for invalid labels", () => {
        expect(isValidCategoryLabel("")).toBe(false)
        expect(isValidCategoryLabel("   ")).toBe(false)
        expect(isValidCategoryLabel("!@#")).toBe(false)
      })
    })

    describe("isValidCategoryIcon", () => {
      it("should return true for icons in the curated list", () => {
        expect(isValidCategoryIcon("Utensils")).toBe(true)
        expect(isValidCategoryIcon("Car")).toBe(true)
        expect(isValidCategoryIcon("Circle")).toBe(true)
      })

      it("should return false for icons not in the list", () => {
        expect(isValidCategoryIcon("RandomIcon")).toBe(false)
        expect(isValidCategoryIcon("")).toBe(false)
      })
    })

    describe("isValidCategoryColor", () => {
      it("should return true for valid hex colors", () => {
        expect(isValidCategoryColor("#FFB07C")).toBe(true)
        expect(isValidCategoryColor("#000000")).toBe(true)
        expect(isValidCategoryColor("#ffffff")).toBe(true)
      })

      it("should return false for invalid colors", () => {
        expect(isValidCategoryColor("red")).toBe(false)
        expect(isValidCategoryColor("#FFF")).toBe(false)
        expect(isValidCategoryColor("FFB07C")).toBe(false)
      })
    })

    describe("isColorFromPalette", () => {
      it("should return true for colors in the palette", () => {
        expect(isColorFromPalette("#FFB07C")).toBe(true)
        expect(isColorFromPalette("#7FDBCA")).toBe(true)
      })

      it("should return false for colors not in the palette", () => {
        expect(isColorFromPalette("#000000")).toBe(false)
        expect(isColorFromPalette("#FFFFFF")).toBe(false)
      })
    })
  })
})
