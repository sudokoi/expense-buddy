import { defaultConfig } from "@tamagui/config/v4"
import { createTamagui, Variable } from "tamagui"
import { NEUTRAL_COLORS, SEMANTIC_COLORS, THEME_COLORS } from "./constants/theme-colors"

const defaultTokens = defaultConfig.tokens as typeof defaultConfig.tokens & {
  color?: Record<string, string>
  space?: Record<string, number>
  radius?: Record<string, number>
  size?: Record<string, number>
  zIndex?: Record<string, number>
}

const defaultFonts = defaultConfig.fonts as typeof defaultConfig.fonts & {
  body: {
    size: Record<string, number>
    lineHeight: Record<string, number>
  }
  heading: {
    size: Record<string, number>
    lineHeight: Record<string, number>
  }
}

const semanticBodyFontSize = {
  micro: defaultFonts.body.size["1"],
  caption: defaultFonts.body.size["2"],
  body: defaultFonts.body.size["3"],
  label: defaultFonts.body.size["4"],
  title: defaultFonts.body.size["5"],
  sectionTitle: defaultFonts.body.size["6"],
  screenTitle: defaultFonts.body.size["7"],
}

const semanticControlBodyFontSize = {
  icon: semanticBodyFontSize.micro,
  chip: semanticBodyFontSize.caption,
  compact: semanticBodyFontSize.body,
  control: semanticBodyFontSize.label,
  prominent: semanticBodyFontSize.title,
  dialog: semanticBodyFontSize.sectionTitle,
  hero: semanticBodyFontSize.screenTitle,
}

const semanticBodyLineHeight = {
  micro: defaultFonts.body.lineHeight["1"],
  caption: defaultFonts.body.lineHeight["2"],
  body: defaultFonts.body.lineHeight["3"],
  label: defaultFonts.body.lineHeight["4"],
  title: defaultFonts.body.lineHeight["5"],
  sectionTitle: defaultFonts.body.lineHeight["6"],
  screenTitle: defaultFonts.body.lineHeight["7"],
}

const semanticControlBodyLineHeight = {
  icon: semanticBodyLineHeight.micro,
  chip: semanticBodyLineHeight.caption,
  compact: semanticBodyLineHeight.body,
  control: semanticBodyLineHeight.label,
  prominent: semanticBodyLineHeight.title,
  dialog: semanticBodyLineHeight.sectionTitle,
  hero: semanticBodyLineHeight.screenTitle,
}

const semanticHeadingFontSize = {
  micro: defaultFonts.heading.size["1"],
  caption: defaultFonts.heading.size["2"],
  body: defaultFonts.heading.size["3"],
  label: defaultFonts.heading.size["4"],
  title: defaultFonts.heading.size["5"],
  sectionTitle: defaultFonts.heading.size["6"],
  screenTitle: defaultFonts.heading.size["7"],
}

const semanticControlHeadingFontSize = {
  icon: semanticHeadingFontSize.micro,
  chip: semanticHeadingFontSize.caption,
  compact: semanticHeadingFontSize.body,
  control: semanticHeadingFontSize.label,
  prominent: semanticHeadingFontSize.title,
  dialog: semanticHeadingFontSize.sectionTitle,
  hero: semanticHeadingFontSize.screenTitle,
}

const semanticHeadingLineHeight = {
  micro: defaultFonts.heading.lineHeight["1"],
  caption: defaultFonts.heading.lineHeight["2"],
  body: defaultFonts.heading.lineHeight["3"],
  label: defaultFonts.heading.lineHeight["4"],
  title: defaultFonts.heading.lineHeight["5"],
  sectionTitle: defaultFonts.heading.lineHeight["6"],
  screenTitle: defaultFonts.heading.lineHeight["7"],
}

const semanticControlHeadingLineHeight = {
  icon: semanticHeadingLineHeight.micro,
  chip: semanticHeadingLineHeight.caption,
  compact: semanticHeadingLineHeight.body,
  control: semanticHeadingLineHeight.label,
  prominent: semanticHeadingLineHeight.title,
  dialog: semanticHeadingLineHeight.sectionTitle,
  hero: semanticHeadingLineHeight.screenTitle,
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
    size: {
      ...defaultTokens.size,
      icon: defaultTokens.size?.["$1"] ?? 20,
      chip: defaultTokens.size?.["$2"] ?? 28,
      compact: defaultTokens.size?.["$3"] ?? 36,
      control: defaultTokens.size?.["$4"] ?? 44,
      prominent: defaultTokens.size?.["$5"] ?? 52,
      dialog: defaultTokens.size?.["$6"] ?? 64,
      hero: defaultTokens.size?.["$7"] ?? 74,
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
  fonts: {
    ...defaultConfig.fonts,
    body: {
      ...defaultFonts.body,
      size: {
        ...defaultFonts.body.size,
        ...semanticBodyFontSize,
        ...semanticControlBodyFontSize,
      },
      lineHeight: {
        ...defaultFonts.body.lineHeight,
        ...semanticBodyLineHeight,
        ...semanticControlBodyLineHeight,
      },
    },
    heading: {
      ...defaultFonts.heading,
      size: {
        ...defaultFonts.heading.size,
        ...semanticHeadingFontSize,
        ...semanticControlHeadingFontSize,
      },
      lineHeight: {
        ...defaultFonts.heading.lineHeight,
        ...semanticHeadingLineHeight,
        ...semanticControlHeadingLineHeight,
      },
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
