import { getReadableTextColor } from "../constants/palette"
import type { palette } from "../constants/palette"

type ThemeColors = (typeof palette)[keyof typeof palette]

export function resolveCategoryColor(color: string) {
  const iconColor = getReadableTextColor(color)
  return { resolvedColor: color, iconColor }
}

export function resolveCategoryVisual(
  categoryColor: string,
  isSelected: boolean,
  theme: ThemeColors
): { backgroundColor: string; borderColor: string; textColor: string } {
  if (!isSelected) {
    return {
      backgroundColor: theme.muted,
      borderColor: theme.border,
      textColor: theme.foreground,
    }
  }
  const { resolvedColor, iconColor } = resolveCategoryColor(categoryColor)
  return {
    backgroundColor: resolvedColor,
    borderColor: resolvedColor,
    textColor: iconColor,
  }
}
