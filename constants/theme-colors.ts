/**
 * Kawaii theme colors - centralized semantic colors
 * Single source of truth for all theme-related colors
 */

// Status/notification colors (kawaii versions)
export const SEMANTIC_COLORS = {
  success: "#7FDBAA", // Soft mint green
  error: "#FF8A8A", // Soft coral/rose
  warning: "#FFD4A0", // Soft peach
  info: "#87CEEB", // Soft sky blue
} as const

// Expense/income colors
export const FINANCIAL_COLORS = {
  expense: "#FF8A8A", // Soft coral
  expenseLight: "#FFD4D4", // Light coral
  income: "#7FDBAA", // Soft mint
  incomeLight: "#C8F7DC", // Light mint
} as const

// Primary accent colors
export const ACCENT_COLORS = {
  primary: "#FFB6C1", // Kawaii pink
  primaryLight: "#FFD1DC",
  primaryDark: "#FF91A4",
  secondary: "#E6E6FA", // Lavender
  tertiary: "#98FB98", // Mint
} as const

// Chart/graph colors for dark mode compatibility
export const CHART_COLORS = {
  // Light mode
  light: {
    gridLine: "rgba(74, 68, 88, 0.1)", // Soft dark with low opacity
    axisLine: "rgba(74, 68, 88, 0.2)",
    rules: "rgba(74, 68, 88, 0.05)",
    selectedBg: "rgba(255, 182, 193, 0.15)", // Pink tint
  },
  // Dark mode
  dark: {
    gridLine: "rgba(240, 230, 246, 0.1)", // Soft light with low opacity
    axisLine: "rgba(240, 230, 246, 0.2)",
    rules: "rgba(240, 230, 246, 0.05)",
    selectedBg: "rgba(255, 105, 180, 0.15)", // Magenta tint
  },
} as const

// Tooltip/overlay colors
export const OVERLAY_COLORS = {
  light: {
    background: "#FFFAF5", // Soft white
    border: "#E6E6FA", // Lavender
    shadow: "rgba(74, 68, 88, 0.15)",
  },
  dark: {
    background: "#252033", // Dark card
    border: "#3A3050", // Dark lavender
    shadow: "rgba(0, 0, 0, 0.3)",
  },
} as const

// Statistics card colors (kawaii pastel variants)
export const CARD_COLORS = {
  blue: {
    bg: "#E6F3FF", // Soft sky blue
    text: "#4A90B8", // Muted blue
    accent: "#2E7DAF",
  },
  green: {
    bg: "#E8F8EE", // Soft mint
    text: "#5BA87A", // Muted green
    accent: "#4A9668",
  },
  orange: {
    bg: "#FFF3E6", // Soft peach
    text: "#C88A5A", // Muted orange
    accent: "#B87A4A",
  },
  purple: {
    bg: "#F3E8FF", // Soft lavender
    text: "#9A7AB8", // Muted purple
    accent: "#8A6AA8",
  },
} as const

/**
 * Get notification color based on type
 */
export function getNotificationColor(
  type: "success" | "error" | "warning" | "info"
): string {
  return SEMANTIC_COLORS[type]
}

/**
 * Get chart colors based on color scheme
 */
export function getChartColors(colorScheme: "light" | "dark") {
  return CHART_COLORS[colorScheme]
}

/**
 * Get overlay colors based on color scheme
 */
export function getOverlayColors(colorScheme: "light" | "dark") {
  return OVERLAY_COLORS[colorScheme]
}
