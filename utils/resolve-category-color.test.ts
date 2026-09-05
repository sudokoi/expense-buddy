import { CATEGORY_COLORS } from "../constants/category-colors"
import {
  CARD_COLORS,
  palette,
  SEMANTIC_FOREGROUND_COLORS,
  DESTRUCTIVE_COLOR,
  NEUTRAL_COLORS,
} from "../constants/palette"
import { resolveCategoryColor, resolveCategoryVisual } from "./resolve-category-color"

// WCAG relative luminance for the opaque six-digit theme/category colors.
function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => {
      const value = parseInt(channel, 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

describe.each(["light", "dark"] as const)("%s character surfaces", (scheme) => {
  const theme = palette[scheme]

  it.each(Object.entries(CATEGORY_COLORS))(
    "keeps %s's own selected color with readable text and badge icons",
    (_name, color) => {
      const selected = resolveCategoryVisual(color, true, theme)
      expect(selected.backgroundColor).toBe(color)
      expect(
        contrast(selected.textColor, selected.backgroundColor)
      ).toBeGreaterThanOrEqual(4.5)
      const badge = resolveCategoryColor(color)
      expect(contrast(badge.iconColor, badge.resolvedColor)).toBeGreaterThanOrEqual(4.5)
    }
  )

  it("keeps unselected choices softly filled with readable neutral text", () => {
    const visual = resolveCategoryVisual(CATEGORY_COLORS.Food, false, theme)
    expect(visual.backgroundColor).toBe(theme.muted)
    expect(visual.borderColor).toBe(theme.border)
    expect(contrast(visual.textColor, visual.backgroundColor)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(Object.entries(CARD_COLORS[scheme]))(
    "keeps %s summary text and section icons readable on their tint",
    (_name, colors) => {
      expect(contrast(colors.text, colors.bg)).toBeGreaterThanOrEqual(4.5)
    }
  )

  it("keeps amount panels, secondary labels, and payment selections readable", () => {
    expect(contrast(theme.foreground, theme.muted)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(theme.mutedForeground, theme.muted)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(theme.accent, theme.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(theme.accentForeground, theme.accent)).toBeGreaterThanOrEqual(4.5)
  })

  it("keeps income/expense amounts and destructive labels readable", () => {
    const status = SEMANTIC_FOREGROUND_COLORS[scheme]
    for (const background of [theme.background, theme.surface]) {
      expect(contrast(status.error, background)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(status.success, background)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(theme.mutedForeground, background)).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(NEUTRAL_COLORS.white, DESTRUCTIVE_COLOR)).toBeGreaterThanOrEqual(4.5)
  })
})

it.each(["#000000", "#FFFFFF", "#123456", "#FFFF00"])(
  "supports custom category fill %s without assuming pastel colors",
  (color) => {
    const visual = resolveCategoryVisual(color, true, palette.light)
    expect(visual.backgroundColor).toBe(color)
    expect(contrast(visual.textColor, color)).toBeGreaterThanOrEqual(4.5)
  }
)
