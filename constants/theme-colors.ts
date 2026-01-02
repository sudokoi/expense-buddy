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

// Toast notification colors - contrasting backgrounds for each type
// Uses SEMANTIC_COLORS as base for borders, with complementary backgrounds
export const TOAST_COLORS = {
  light: {
    success: {
      background: "#E8F8EE", // Soft mint green (matches CARD_COLORS.green.bg)
      border: SEMANTIC_COLORS.success, // Soft mint green
      text: "#2D5A3D",
    },
    error: {
      background: "#FFE8E8", // Soft coral/rose
      border: SEMANTIC_COLORS.error, // Soft coral/rose
      text: "#8B3A3A",
    },
    warning: {
      background: "#FFF3E6", // Soft peach (matches CARD_COLORS.orange.bg)
      border: SEMANTIC_COLORS.warning, // Soft peach
      text: "#8B5A2B",
    },
    info: {
      background: "#E6F3FF", // Soft sky blue (matches CARD_COLORS.blue.bg)
      border: SEMANTIC_COLORS.info, // Soft sky blue
      text: "#2B5A8B",
    },
  },
  dark: {
    success: {
      background: "#1A3D2A", // Dark mint
      border: SEMANTIC_COLORS.success,
      text: "#C8F7DC",
    },
    error: {
      background: "#3D1A1A", // Dark coral
      border: SEMANTIC_COLORS.error,
      text: "#FFD4D4",
    },
    warning: {
      background: "#3D2A1A", // Dark peach
      border: SEMANTIC_COLORS.warning,
      text: "#FFE8D4",
    },
    info: {
      background: "#1A2A3D", // Dark blue
      border: SEMANTIC_COLORS.info,
      text: "#D4E8FF",
    },
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
 * Get toast colors based on notification type and color scheme
 */
export function getToastColors(
  type: "success" | "error" | "warning" | "info",
  colorScheme: "light" | "dark"
) {
  return TOAST_COLORS[colorScheme][type]
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
