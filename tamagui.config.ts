import { defaultConfig } from "@tamagui/config/v4"
import { createTamagui, Variable } from "tamagui"
import { NEUTRAL_COLORS, SEMANTIC_COLORS, THEME_COLORS } from "./constants/theme-colors"

const defaultTokens = defaultConfig.tokens as typeof defaultConfig.tokens & {
  color?: Record<string, string>
  space?: Record<string, number>
  radius?: Record<string, number>
  zIndex?: Record<string, number>
}

// Extend default config with custom semantic color tokens and kawaii themes
export const config = createTamagui({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    space: {
      ...defaultTokens.space,
      micro: 4,
      control: 8,
      section: 12,
      gutter: 16,
      block: 20,
      empty: 40,
    },
    radius: {
      ...defaultTokens.radius,
      control: 8,
      chip: 12,
      surface: 16,
      round: 999,
    },
    zIndex: {
      ...defaultTokens.zIndex,
      banner: 9998,
      toast: 9999,
      floating: 10000,
    },
    color: {
      // Preserve any existing color tokens from default config
      ...defaultTokens.color,
      // Kawaii primary colors
      kawaiiPink: THEME_COLORS.kawaiiPink,
      kawaiiPinkLight: THEME_COLORS.kawaiiPinkLight,
      kawaiiPinkDark: THEME_COLORS.kawaiiPinkDark,
      kawaiiLavender: THEME_COLORS.kawaiiLavender,
      kawaiiMint: THEME_COLORS.kawaiiMint,
      // Kawaii background colors
      kawaiiCream: THEME_COLORS.kawaiiCream,
      kawaiiSoftWhite: THEME_COLORS.kawaiiSoftWhite,
      kawaiiDarkPurple: THEME_COLORS.kawaiiDarkPurple,
      kawaiiDarkCard: THEME_COLORS.kawaiiDarkCard,
      // Kawaii text colors
      kawaiiSoftDark: THEME_COLORS.kawaiiSoftDark,
      kawaiiMutedPurple: THEME_COLORS.kawaiiMutedPurple,
      kawaiiSoftLight: THEME_COLORS.kawaiiSoftLight,
      kawaiiMutedLavender: THEME_COLORS.kawaiiMutedLavender,
      // Semantic expense colors (kawaii versions)
      expenseRed: SEMANTIC_COLORS.error,
      expenseRedLight: "#FFD4D4",
      incomeGreen: SEMANTIC_COLORS.success,
      incomeGreenLight: "#C8F7DC",
      // Status colors (kawaii versions)
      success: SEMANTIC_COLORS.success,
      error: SEMANTIC_COLORS.error,
      warning: SEMANTIC_COLORS.warning,
      info: SEMANTIC_COLORS.info,
    },
  },
  themes: {
    ...defaultConfig.themes,
    // Override light theme with kawaii colors
    light: {
      ...defaultConfig.themes.light,
      background: THEME_COLORS.kawaiiCream,
      backgroundHover: THEME_COLORS.kawaiiSoftWhite,
      backgroundPress: "#FFE8E0",
      backgroundFocus: THEME_COLORS.kawaiiSoftWhite,
      color: THEME_COLORS.kawaiiSoftDark,
      colorHover: "#3A3448",
      colorPress: "#2A2438",
      colorFocus: THEME_COLORS.kawaiiSoftDark,
      borderColor: THEME_COLORS.kawaiiLavender,
      borderColorHover: "#DDA0DD",
      borderColorFocus: THEME_COLORS.kawaiiPink,
      borderColorPress: "#DDA0DD",
      placeholderColor: THEME_COLORS.kawaiiMutedPurple,
    },
    // Override dark theme with kawaii colors
    dark: {
      ...defaultConfig.themes.dark,
      background: THEME_COLORS.kawaiiDarkPurple,
      backgroundHover: THEME_COLORS.kawaiiDarkCard,
      backgroundPress: "#302840",
      backgroundFocus: THEME_COLORS.kawaiiDarkCard,
      color: THEME_COLORS.kawaiiSoftLight,
      colorHover: "#FFFFFF",
      colorPress: "#E0D6E6",
      colorFocus: THEME_COLORS.kawaiiSoftLight,
      borderColor: "#3A3050", // Dark lavender border
      borderColorHover: "#9370DB",
      borderColorFocus: "#FF69B4",
      borderColorPress: "#9370DB",
      placeholderColor: THEME_COLORS.kawaiiMutedLavender,
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
