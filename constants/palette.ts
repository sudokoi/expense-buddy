/**
 * Single source of truth for the app's theme tokens.
 *
 * `global.css` (--background, --foreground, --accent, …) and `tailwind.config.js`
 * (colors mapping to those CSS variables) must stay in sync with this file —
 * update values here first and mirror them in those two places.
 * This file also owns DESTRUCTIVE_COLOR and KAWAII_COLORS which were previously
 * CSS-only orphans (global.css vars without a JS source).
 *
 * Contrast fixes (ADR-008): the interactive accent is now a deep rose and the
 * muted foregrounds are darkened/lightened so text and selected states meet
 * WCAG AA against the light and dark backgrounds.
 */

export const palette = {
  light: {
    // Warm cream neutrals — the foreground/muted-foreground/border are
    // rose-tinted so they harmonize with the kawaii accent instead of clashing
    // with the cool lavender they replaced.
    background: "#FFF8F0",
    surface: "#FFFAF5",
    muted: "#FFE0D2",
    foreground: "#473E4B",
    mutedForeground: "#6C5A6C",
    border: "#D6C9C2",
    accent: "#C0406A",
    accentForeground: "#FFFFFF",
  },
  dark: {
    // Warm plum family — harmonizes with the warm cream light theme instead
    // of the previous cool violet. All text/UI contrast still clears WCAG AA.
    background: "#1D161B",
    surface: "#27202A",
    muted: "#4A3D52",
    foreground: "#F2E9EE",
    mutedForeground: "#CCBFC9",
    border: "#3B3342",
    accent: "#FFB6C1",
    accentForeground: "#1D161B",
  },
} as const

export type ThemeScheme = keyof typeof palette

// Status/notification colors (kawaii pastel versions) — used as soft FILLS
// (e.g. toast/banner backgrounds) where dark text is placed on top.
export const SEMANTIC_COLORS = {
  success: "#7FDBAA",
  error: "#FF8A8A",
  warning: "#FFD4A0",
  info: "#87CEEB",
} as const

// Theme-aware semantic FOREGROUND colors — deep in light mode so text/icons
// stay readable on cream surfaces, pastel in dark mode where they glow on the
// dark background. Mirrors the `--error/--success/--warning/--info` CSS vars.
export const SEMANTIC_FOREGROUND_COLORS = {
  light: {
    success: "#1E7A4F",
    error: "#C93A3F",
    warning: "#A16207",
    info: "#1E5FB3",
  },
  dark: {
    success: "#7FDBAA",
    error: "#FF8A8A",
    warning: "#FFD4A0",
    info: "#87CEEB",
  },
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
  primaryLightDark: "#4A2040",
} as const

// Chart/graph colors for dark mode compatibility
export const CHART_COLORS = {
  light: {
    gridLine: "rgba(71, 62, 75, 0.1)",
    axisLine: "rgba(71, 62, 75, 0.2)",
    rules: "rgba(71, 62, 75, 0.05)",
    selectedBg: "rgba(255, 182, 193, 0.15)",
  },
  dark: {
    gridLine: "rgba(242, 233, 238, 0.1)",
    axisLine: "rgba(242, 233, 238, 0.2)",
    rules: "rgba(242, 233, 238, 0.05)",
    selectedBg: "rgba(255, 105, 180, 0.15)",
  },
} as const

// Tooltip/overlay colors
export const OVERLAY_COLORS = {
  light: {
    background: "#FFFAF5",
    border: "#D6C9C2",
    shadow: "rgba(71, 62, 75, 0.15)",
  },
  dark: {
    background: "#27202A",
    border: "#3B3342",
    shadow: "rgba(0, 0, 0, 0.3)",
  },
} as const

// Statistics card colors (kawaii pastel variants with dark-mode support)
export const CARD_COLORS = {
  light: {
    // Text colors deepened to clear WCAG AA (>=4.5:1) on the pastel fills.
    blue: { bg: "#E6F3FF", text: "#2D6E9C", accent: "#255F89" },
    green: { bg: "#E8F8EE", text: "#31794E", accent: "#2D744A" },
    orange: { bg: "#FFF3E6", text: "#A05B29", accent: "#9B5727" },
    purple: { bg: "#F3E8FF", text: "#785698", accent: "#6A4B8E" },
  },
  dark: {
    blue: { bg: "#1E2A3A", text: "#7CB8D8", accent: "#5BA0D0" },
    green: { bg: "#1E2E24", text: "#7EC89A", accent: "#5FB87A" },
    orange: { bg: "#2E2418", text: "#D8A870", accent: "#C89050" },
    purple: { bg: "#261E34", text: "#B898D0", accent: "#A080C0" },
  },
} as const

export const NEUTRAL_COLORS = {
  white: "#FFFFFF",
  black: "#000000",
} as const

// Destructive (WCAG-safe on white text, identical across themes per c4fe782)
export const DESTRUCTIVE_COLOR = "#C93A3F" as const

// Kawaii decorative palette — mirrors global.css vars that have no light/dark variant
export const KAWAII_COLORS = {
  pink: "#FFB6C1",
  pinkLight: "#FFD1DC",
  pinkDark: "#FF91A4",
  lavender: "#E6E6FA",
  mint: "#98FB98",
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
