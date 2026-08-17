/**
 * Single source of truth for the app's theme tokens.
 *
 * `global.css` (--background, --foreground, --accent, …) and `tailwind.config.js`
 * (colors mapping to those CSS variables) must stay in sync with this file —
 * update values here first and mirror them in those two places.
 *
 * Contrast fixes (ADR-008): the interactive accent is now a deep rose and the
 * muted foregrounds are darkened/lightened so text and selected states meet
 * WCAG AA against the light and dark backgrounds.
 */

export const palette = {
  light: {
    background: "#FFF8F0",
    surface: "#FFFAF5",
    muted: "#FFE8E0",
    foreground: "#4A4458",
    mutedForeground: "#6B5F7A",
    border: "#E6E6FA",
    accent: "#C0406A",
    accentForeground: "#FFFFFF",
  },
  dark: {
    background: "#1A1625",
    surface: "#252033",
    muted: "#302840",
    foreground: "#F0E6F6",
    mutedForeground: "#C7B9D6",
    border: "#3A3050",
    accent: "#FFB6C1",
    accentForeground: "#1A1625",
  },
} as const

export type ThemeScheme = keyof typeof palette

// Status/notification colors (kawaii pastel versions)
export const SEMANTIC_COLORS = {
  success: "#7FDBAA",
  error: "#FF8A8A",
  warning: "#FFD4A0",
  info: "#87CEEB",
} as const

// Notification text colors (dark-on-pastel for readability)
const NOTIFICATION_TEXT = {
  success: "#1A5A3A",
  error: "#8B2A2A",
  warning: "#6B4A1A",
  info: "#1A4A6B",
} as const

// Shared style tokens for notification-like surfaces (toast/banner)
export const NOTIFICATION_STYLE_TOKENS = {
  success: {
    iconBg: "rgba(255, 255, 255, 0.3)",
    textColor: NOTIFICATION_TEXT.success,
    borderColor: "rgba(255, 255, 255, 0.4)",
    actionBg: "rgba(255, 255, 255, 0.35)",
    actionBorderColor: "rgba(255, 255, 255, 0.55)",
  },
  error: {
    iconBg: "rgba(255, 255, 255, 0.3)",
    textColor: NOTIFICATION_TEXT.error,
    borderColor: "rgba(255, 255, 255, 0.4)",
    actionBg: "rgba(255, 255, 255, 0.35)",
    actionBorderColor: "rgba(255, 255, 255, 0.55)",
  },
  warning: {
    iconBg: "rgba(255, 255, 255, 0.3)",
    textColor: NOTIFICATION_TEXT.warning,
    borderColor: "rgba(255, 255, 255, 0.4)",
    actionBg: "rgba(255, 255, 255, 0.35)",
    actionBorderColor: "rgba(255, 255, 255, 0.55)",
  },
  info: {
    iconBg: "rgba(255, 255, 255, 0.3)",
    textColor: NOTIFICATION_TEXT.info,
    borderColor: "rgba(255, 255, 255, 0.4)",
    actionBg: "rgba(255, 255, 255, 0.35)",
    actionBorderColor: "rgba(255, 255, 255, 0.55)",
  },
} as const

// Expense/income colors (soft kawaii pastels)
export const FINANCIAL_COLORS = {
  expense: "#FF8A8A",
  expenseLight: "#FFD4D4",
  income: "#7FDBAA",
  incomeLight: "#C8F7DC",
} as const

// Readable text variants for currency amounts (high-contrast for legibility)
export const AMOUNT_COLORS = {
  expense: "#E5484D",
  income: "#30A46C",
} as const

// Primary accent colors (interactive accent is a deep rose for AA contrast)
export const ACCENT_COLORS = {
  primary: "#C0406A",
  primaryLight: "#FFD1DC",
} as const

// Chart/graph colors for dark mode compatibility
export const CHART_COLORS = {
  light: {
    gridLine: "rgba(74, 68, 88, 0.1)",
    axisLine: "rgba(74, 68, 88, 0.2)",
    rules: "rgba(74, 68, 88, 0.05)",
    selectedBg: "rgba(255, 182, 193, 0.15)",
  },
  dark: {
    gridLine: "rgba(240, 230, 246, 0.1)",
    axisLine: "rgba(240, 230, 246, 0.2)",
    rules: "rgba(240, 230, 246, 0.05)",
    selectedBg: "rgba(255, 105, 180, 0.15)",
  },
} as const

// Tooltip/overlay colors
export const OVERLAY_COLORS = {
  light: {
    background: "#FFFAF5",
    border: "#E6E6FA",
    shadow: "rgba(74, 68, 88, 0.15)",
  },
  dark: {
    background: "#252033",
    border: "#3A3050",
    shadow: "rgba(0, 0, 0, 0.3)",
  },
} as const

// Statistics card colors (kawaii pastel variants)
export const CARD_COLORS = {
  blue: {
    bg: "#E6F3FF",
    text: "#4A90B8",
    accent: "#2E7DAF",
  },
  green: {
    bg: "#E8F8EE",
    text: "#5BA87A",
    accent: "#4A9668",
  },
  orange: {
    bg: "#FFF3E6",
    text: "#C88A5A",
    accent: "#B87A4A",
  },
  purple: {
    bg: "#F3E8FF",
    text: "#9A7AB8",
    accent: "#8A6AA8",
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

export function getNotificationColor(
  type: "success" | "error" | "warning" | "info"
): string {
  return SEMANTIC_COLORS[type]
}

export function getChartColors(colorScheme: "light" | "dark") {
  return CHART_COLORS[colorScheme]
}

export function getOverlayColors(colorScheme: "light" | "dark") {
  return OVERLAY_COLORS[colorScheme]
}
