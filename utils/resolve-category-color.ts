import { getReadableTextColor } from "../constants/palette"

export function resolveCategoryColor(color: string) {
  const iconColor = getReadableTextColor(color)
  return { resolvedColor: color, iconColor }
}
