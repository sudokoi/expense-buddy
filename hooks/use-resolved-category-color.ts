import { useMemo } from "react"
import { getReadableTextColor } from "../constants/theme-colors"

export function useResolvedCategoryColor(color: string) {
  const resolvedColor = useMemo(() => color, [color])
  const iconColor = useMemo(() => getReadableTextColor(resolvedColor), [resolvedColor])
  return { resolvedColor, iconColor }
}
