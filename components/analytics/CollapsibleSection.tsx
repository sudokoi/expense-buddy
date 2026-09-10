import { useState, ReactNode, memo, useCallback } from "react"
import { Pressable, Text, View } from "react-native"
import { Card } from "../ui/Card"
import { ChevronDown, ChevronUp } from "lucide-react-native"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { UI_ICON_SIZE } from "../../constants/ui-tokens"
import { useDisplayDensity } from "../../hooks/use-display-density"

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
  const { density, space } = useDisplayDensity()

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  return (
    <Card>
      <Pressable
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: isExpanded }}
      >
        <View
          className={`min-h-control-height flex-row items-center justify-between gap-ui-control rounded-t-card bg-surface p-ui-section ${
            isExpanded ? "rounded-b-none" : "rounded-b-card"
          }`}
        >
          <Text className="flex-1 text-sm font-bold text-foreground">{title}</Text>
          {isExpanded ? (
            <ChevronUp size={UI_ICON_SIZE.medium} color={theme.foreground} />
          ) : (
            <ChevronDown size={UI_ICON_SIZE.medium} color={theme.foreground} />
          )}
        </View>
      </Pressable>

      {isExpanded && (
        <View
          className="p-2.5 pt-1.5"
          style={
            density === "compact"
              ? { padding: space.section, paddingTop: space.micro }
              : undefined
          }
        >
          {children}
        </View>
      )}
    </Card>
  )
})

export type { CollapsibleSectionProps }
