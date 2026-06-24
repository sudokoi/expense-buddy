import { useMemo } from "react"
import { getColorValue } from "../tamagui.config"
import { getReadableTextColor } from "../constants/theme-colors"

export function useResolvedCategoryColor(color: string) {
  const resolvedColor = useMemo(() => getColorValue(color), [color])
  const iconColor = useMemo(() => getReadableTextColor(resolvedColor), [resolvedColor])
  return { resolvedColor, iconColor }
}
