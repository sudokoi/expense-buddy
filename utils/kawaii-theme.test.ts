/**
 * Property-based tests for Kawaii Theme color system
 */

import fc from "fast-check"
import { ExpenseCategory } from "../types/expense"
import { CATEGORY_COLORS, getCategoryColor } from "../constants/category-colors"

const ALL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Food",
  "Groceries",
  "Transport",
  "Rent",
  "Utilities",
  "Entertainment",
  "Health",
  "Other",
]

const SEMANTIC_COLORS = {
  success: "#7FDBAA",
  error: "#FF8A8A",
  warning: "#FFD4A0",
  info: "#87CEEB",
}

function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

describe("Category Color Completeness", () => {
  it("should have a valid hex color defined for every expense category", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ExpenseCategory>(...ALL_EXPENSE_CATEGORIES),
        (category) => {
          const color = getCategoryColor(category)
          return isValidHexColor(color)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should have all eight categories defined in CATEGORY_COLORS", () => {
    const definedCategories = Object.keys(CATEGORY_COLORS) as ExpenseCategory[]

    for (const category of ALL_EXPENSE_CATEGORIES) {
      expect(definedCategories).toContain(category)
    }

    expect(definedCategories.length).toBe(ALL_EXPENSE_CATEGORIES.length)
  })
})

describe("Category Color Uniqueness", () => {
  it("should have unique colors for any two distinct categories", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ExpenseCategory>(...ALL_EXPENSE_CATEGORIES),
        fc.constantFrom<ExpenseCategory>(...ALL_EXPENSE_CATEGORIES),
        (category1, category2) => {
          if (category1 === category2) return true

          const color1 = getCategoryColor(category1)
          const color2 = getCategoryColor(category2)

          return color1.toLowerCase() !== color2.toLowerCase()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should have no duplicate colors in CATEGORY_COLORS", () => {
    const colors = Object.values(CATEGORY_COLORS).map((c) => c.toLowerCase())
    const uniqueColors = new Set(colors)

    expect(uniqueColors.size).toBe(colors.length)
  })
})

describe("Semantic Color Distinguishability", () => {
  const semanticColorNames = ["success", "error", "warning", "info"] as const
  type SemanticColorName = (typeof semanticColorNames)[number]

  it("should have unique colors for any two distinct semantic purposes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SemanticColorName>(...semanticColorNames),
        fc.constantFrom<SemanticColorName>(...semanticColorNames),
        (purpose1, purpose2) => {
          if (purpose1 === purpose2) return true

          const color1 = SEMANTIC_COLORS[purpose1]
          const color2 = SEMANTIC_COLORS[purpose2]

          return color1.toLowerCase() !== color2.toLowerCase()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should have all semantic colors as valid hex colors", () => {
    for (const color of Object.values(SEMANTIC_COLORS)) {
      expect(isValidHexColor(color)).toBe(true)
    }
  })

  it("should have no duplicate semantic colors", () => {
    const colors = Object.values(SEMANTIC_COLORS).map((c) => c.toLowerCase())
    const uniqueColors = new Set(colors)

    expect(uniqueColors.size).toBe(colors.length)
  })
})
