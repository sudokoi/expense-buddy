import { useState, ReactNode, memo, useCallback } from "react"
import { YStack, XStack, Text, Card } from "tamagui"
import { ChevronDown, ChevronUp } from "@tamagui/lucide-icons-2"
import { Pressable } from "react-native"
import {
  UI_SPACE,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"

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

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  return (
    <Card borderWidth={UI_BORDER_WIDTH.thin} borderColor="$borderColor">
      <Pressable onPress={toggleExpanded}>
        <XStack
          p={UI_SPACE.section - 2}
          justify="space-between"
          items="center"
          bg="$backgroundHover"
          borderTopLeftRadius="$surface"
          borderTopRightRadius="$surface"
          borderBottomLeftRadius={isExpanded ? 0 : "$surface"}
          borderBottomRightRadius={isExpanded ? 0 : "$surface"}
        >
          <Text fontWeight={UI_FONT_WEIGHT.bold} fontSize="$label">
            {title}
          </Text>
          {isExpanded ? (
            <ChevronUp size={UI_ICON_SIZE.medium} color="$color" />
          ) : (
            <ChevronDown size={UI_ICON_SIZE.medium} color="$color" />
          )}
        </XStack>
      </Pressable>

      {isExpanded && (
        <YStack p={UI_SPACE.section - 2} pt={UI_SPACE.control - 2}>
          {children}
        </YStack>
      )}
    </Card>
  )
})

export type { CollapsibleSectionProps }
