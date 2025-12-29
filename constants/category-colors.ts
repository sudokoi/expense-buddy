import { ExpenseCategory } from "../types/expense"

/**
 * Kawaii category colors - single source of truth
 * Soft pastel colors for a cute aesthetic
 */
export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Food: "#FFB07C", // soft coral/peach
  Groceries: "#7FDBCA", // soft mint/seafoam
  Transport: "#87CEEB", // soft sky blue
  Utilities: "#FFE4A0", // soft butter yellow
  Entertainment: "#DDA0DD", // soft lavender/plum
  Health: "#FFB5BA", // soft rose pink
  Other: "#C4B7C9", // soft warm mauve
}

/**
 * Get the color for a category, with fallback
 */
export function getCategoryColor(category: ExpenseCategory): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other
}
