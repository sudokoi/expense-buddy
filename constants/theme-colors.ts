/**
 * Kawaii theme colors - centralized semantic colors
 * Single source of truth for all theme-related colors
 */

export const THEME_COLORS = {
  kawaiiPink: "#FFB6C1",
  kawaiiPinkLight: "#FFD1DC",
  kawaiiPinkDark: "#FF91A4",
  kawaiiLavender: "#E6E6FA",
  kawaiiMint: "#98FB98",
  kawaiiCream: "#FFF8F0",
  kawaiiSoftWhite: "#FFFAF5",
  kawaiiDarkPurple: "#1A1625",
  kawaiiDarkCard: "#252033",
  kawaiiSoftDark: "#4A4458",
  kawaiiMutedPurple: "#8B7B96",
  kawaiiSoftLight: "#F0E6F6",
  kawaiiMutedLavender: "#B8A9C9",
  successText: "#1A5A3A",
  errorText: "#8B2A2A",
  warningText: "#6B4A1A",
  infoText: "#1A4A6B",
  mutedBlue: "#4A90B8",
  strongBlue: "#2E7DAF",
  mutedGreen: "#5BA87A",
  strongGreen: "#4A9668",
  mutedOrange: "#C88A5A",
  strongOrange: "#B87A4A",
  mutedPurple: "#9A7AB8",
  strongPurple: "#8A6AA8",
} as const

// Status/notification colors (kawaii versions)
export const SEMANTIC_COLORS = {
  success: "#7FDBAA", // Soft mint green
  error: "#FF8A8A", // Soft coral/rose
  warning: "#FFD4A0", // Soft peach
  info: "#87CEEB", // Soft sky blue
} as const

// Shared style tokens for notification-like surfaces (toast/banner)
// Keep these centralized so UI components avoid hardcoded color literals.
export const NOTIFICATION_STYLE_TOKENS = {
  success: {
    iconBg: "rgba(255, 255, 255, 0.3)",
    textColor: THEME_COLORS.successText,
    borderColor: "rgba(255, 255, 255, 0.4)",
    actionBg: "rgba(255, 255, 255, 0.35)",
    actionBorderColor: "rgba(255, 255, 255, 0.55)",
  },
  error: {
    iconBg: "rgba(255, 255, 255, 0.3)",
    textColor: THEME_COLORS.errorText,
    borderColor: "rgba(255, 255, 255, 0.4)",
    actionBg: "rgba(255, 255, 255, 0.35)",
    actionBorderColor: "rgba(255, 255, 255, 0.55)",
  },
  warning: {
    iconBg: "rgba(255, 255, 255, 0.3)",
    textColor: THEME_COLORS.warningText,
    borderColor: "rgba(255, 255, 255, 0.4)",
    actionBg: "rgba(255, 255, 255, 0.35)",
    actionBorderColor: "rgba(255, 255, 255, 0.55)",
  },
  info: {
    iconBg: "rgba(255, 255, 255, 0.3)",
    textColor: THEME_COLORS.infoText,
    borderColor: "rgba(255, 255, 255, 0.4)",
    actionBg: "rgba(255, 255, 255, 0.35)",
    actionBorderColor: "rgba(255, 255, 255, 0.55)",
  },
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
  primary: THEME_COLORS.kawaiiPink,
  primaryLight: THEME_COLORS.kawaiiPinkLight,
  primaryDark: THEME_COLORS.kawaiiPinkDark,
  secondary: THEME_COLORS.kawaiiLavender,
  tertiary: THEME_COLORS.kawaiiMint,
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
    background: THEME_COLORS.kawaiiSoftWhite,
    border: THEME_COLORS.kawaiiLavender,
    shadow: "rgba(74, 68, 88, 0.15)",
  },
  dark: {
    background: THEME_COLORS.kawaiiDarkCard,
    border: "#3A3050",
    shadow: "rgba(0, 0, 0, 0.3)",
  },
} as const

// Statistics card colors (kawaii pastel variants)
export const CARD_COLORS = {
  blue: {
    bg: "#E6F3FF", // Soft sky blue
    text: THEME_COLORS.mutedBlue,
    accent: THEME_COLORS.strongBlue,
  },
  green: {
    bg: "#E8F8EE", // Soft mint
    text: THEME_COLORS.mutedGreen,
    accent: THEME_COLORS.strongGreen,
  },
  orange: {
    bg: "#FFF3E6", // Soft peach
    text: THEME_COLORS.mutedOrange,
    accent: THEME_COLORS.strongOrange,
  },
  purple: {
    bg: "#F3E8FF", // Soft lavender
    text: THEME_COLORS.mutedPurple,
    accent: THEME_COLORS.strongPurple,
  },
} as const

export const NEUTRAL_COLORS = {
  white: "#FFFFFF",
  black: "#000000",
} as const

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().toLowerCase()
  const match = /^#([0-9a-f]{6})$/.exec(normalized)
  if (!match) return null
  const value = match[1]
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return { r, g, b }
}

function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const R = srgbToLinear(r)
  const G = srgbToLinear(g)
  const B = srgbToLinear(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Returns either black or white text for best contrast on a given hex background.
 * Uses WCAG contrast ratio (relative luminance), but only compares against black/white.
 */
export function getReadableTextColor(backgroundHex: string): `#${string}` {
  const rgb = hexToRgb(backgroundHex)
  if (!rgb) return NEUTRAL_COLORS.white

  const bgL = relativeLuminance(rgb)
  const whiteContrast = contrastRatio(1, bgL)
  const blackContrast = contrastRatio(0, bgL)

  return (
    whiteContrast >= blackContrast ? NEUTRAL_COLORS.white : NEUTRAL_COLORS.black
  ) as `#${string}`
}

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
