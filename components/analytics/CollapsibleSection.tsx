import { useState, ReactNode, memo, useCallback } from "react"
import { Pressable, Text, View } from "react-native"
import { Card } from "../ui/Card"
import { ChevronDown, ChevronUp } from "lucide-react-native"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { UI_ICON_SIZE } from "../../constants/ui-tokens"

interface CollapsibleSectionProps {
  title: string
  defaultExpanded?: boolean
  children: ReactNode
}

/**
 * CollapsibleSection - Reusable wrapper with expand/collapse toggle
 * Features static chevron indicator that changes direction based on state
 * Memoized to prevent unnecessary re-renders
 */
export const CollapsibleSection = memo(function CollapsibleSection({
  title,
  defaultExpanded = true,
  children,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const theme = useThemeColors()

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  return (
    <Card>
      <Pressable onPress={toggleExpanded}>
        <View
          className={`flex-row items-center justify-between rounded-t-card bg-surface p-2.5 ${
            isExpanded ? "rounded-b-none" : "rounded-b-card"
          }`}
        >
          <Text className="text-sm font-bold">{title}</Text>
          {isExpanded ? (
            <ChevronUp size={UI_ICON_SIZE.medium} color={theme.foreground} />
          ) : (
            <ChevronDown size={UI_ICON_SIZE.medium} color={theme.foreground} />
          )}
        </View>
      </Pressable>

      {isExpanded && <View className="p-2.5 pt-1.5">{children}</View>}
    </Card>
  )
})

export type { CollapsibleSectionProps }
