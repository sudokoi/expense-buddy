/**
 * Kawaii category colors - single source of truth
 * Soft pastel colors for a cute aesthetic
 * Uses string keys to support dynamic custom categories
 */
export const CATEGORY_COLORS: Record<string, `#${string}`> = {
  Food: "#FFB07C", // soft coral/peach
  Groceries: "#7FDBCA", // soft mint/seafoam
  Transport: "#87CEEB", // soft sky blue
  Rent: "#A8C686", // soft olive green
  Utilities: "#FFE4A0", // soft butter yellow
  Entertainment: "#DDA0DD", // soft lavender/plum
  Health: "#FFB5BA", // soft rose pink
  Other: "#C4B7C9", // soft warm mauve
}

/**
 * Get the color for a category, with fallback
 */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other
}

/**
 * Extended color palette for custom categories
 * 16 soft pastel colors consistent with the app's kawaii aesthetic
 */
export const CATEGORY_COLOR_PALETTE: string[] = [
  "#FFB07C", // soft coral/peach
  "#7FDBCA", // soft mint/seafoam
  "#87CEEB", // soft sky blue
  "#A8C686", // soft olive green
  "#FFE4A0", // soft butter yellow
  "#DDA0DD", // soft lavender/plum
  "#FFB5BA", // soft rose pink
  "#C4B7C9", // soft warm mauve
  "#B8D4E3", // soft powder blue
  "#F5D5CB", // soft blush
  "#C9E4CA", // soft sage
  "#E8D5B7", // soft sand
  "#D4C4FB", // soft periwinkle
  "#FFDAB9", // soft peach puff
  "#B0E0E6", // soft powder blue alt
  "#E6E6FA", // soft lavender
]

/**
 * Get a random color from the palette, preferring colors not already in use
 * @param existingColors - Array of colors already assigned to categories
 * @returns A hex color string from the palette
 */
export function getRandomCategoryColor(existingColors: string[]): string {
  // Filter out already-used colors
  const available = CATEGORY_COLOR_PALETTE.filter(
    (color) => !existingColors.includes(color)
  )

  // If all colors used, pick from full palette
  const pool = available.length > 0 ? available : CATEGORY_COLOR_PALETTE

  return pool[Math.floor(Math.random() * pool.length)]
}
