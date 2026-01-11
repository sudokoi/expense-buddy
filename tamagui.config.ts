import { defaultConfig } from "@tamagui/config/v4"
import { createTamagui, Variable } from "tamagui"
import { NEUTRAL_COLORS } from "./constants/theme-colors"

// Extend default config with custom semantic color tokens and kawaii themes
export const config = createTamagui({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    color: {
      // Preserve any existing color tokens from default config
      ...(defaultConfig.tokens as { color?: Record<string, string> }).color,
      // Kawaii primary colors
      kawaiiPink: "#FFB6C1",
      kawaiiPinkLight: "#FFD1DC",
      kawaiiPinkDark: "#FF91A4",
      kawaiiLavender: "#E6E6FA",
      kawaiiMint: "#98FB98",
      // Kawaii background colors
      kawaiiCream: "#FFF8F0",
      kawaiiSoftWhite: "#FFFAF5",
      kawaiiDarkPurple: "#1A1625",
      kawaiiDarkCard: "#252033",
      // Kawaii text colors
      kawaiiSoftDark: "#4A4458",
      kawaiiMutedPurple: "#8B7B96",
      kawaiiSoftLight: "#F0E6F6",
      kawaiiMutedLavender: "#B8A9C9",
      // Semantic expense colors (kawaii versions)
      expenseRed: "#FF8A8A",
      expenseRedLight: "#FFD4D4",
      incomeGreen: "#7FDBAA",
      incomeGreenLight: "#C8F7DC",
      // Status colors (kawaii versions)
      success: "#7FDBAA",
      error: "#FF8A8A",
      warning: "#FFD4A0",
      info: "#87CEEB",
    },
  },
  themes: {
    ...defaultConfig.themes,
    // Override light theme with kawaii colors
    light: {
      ...defaultConfig.themes.light,
      background: "#FFF8F0", // Kawaii cream
      backgroundHover: "#FFFAF5",
      backgroundPress: "#FFE8E0",
      backgroundFocus: "#FFFAF5",
      color: "#4A4458", // Soft dark (not pure black)
      colorHover: "#3A3448",
      colorPress: "#2A2438",
      colorFocus: "#4A4458",
      borderColor: "#E6E6FA", // Lavender border
      borderColorHover: "#DDA0DD",
      borderColorFocus: "#FFB6C1",
      borderColorPress: "#DDA0DD",
      placeholderColor: "#8B7B96", // Muted purple
    },
    // Override dark theme with kawaii colors
    dark: {
      ...defaultConfig.themes.dark,
      background: "#1A1625", // Dark purple
      backgroundHover: "#252033",
      backgroundPress: "#302840",
      backgroundFocus: "#252033",
      color: "#F0E6F6", // Soft light (not pure white)
      colorHover: "#FFFFFF",
      colorPress: "#E0D6E6",
      colorFocus: "#F0E6F6",
      borderColor: "#3A3050", // Dark lavender border
      borderColorHover: "#9370DB",
      borderColorFocus: "#FF69B4",
      borderColorPress: "#9370DB",
      placeholderColor: "#B8A9C9", // Muted lavender
    },
  },
})

export default config

export type Conf = typeof config

declare module "tamagui" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends Conf {}
}

/**
 * Extracts the raw color value from a Tamagui theme variable.
 * Returns a type that's compatible with Tamagui's color props.
 */
export function getColorValue(
  variable: Variable<string> | string | undefined
): `#${string}` {
  // Prefer a centralized neutral rather than an inline literal.
  if (!variable) return NEUTRAL_COLORS.black
  if (typeof variable === "string") return variable as `#${string}`
  return variable.val as `#${string}`
}
