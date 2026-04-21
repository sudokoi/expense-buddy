import { useState, ReactNode, memo, useCallback } from "react"
import { YStack, XStack, Text, Card } from "tamagui"
import { ChevronDown, ChevronUp } from "@tamagui/lucide-icons"
import { Pressable, ViewStyle } from "react-native"
import { UI_SPACE } from "../../constants/ui-tokens"

interface CollapsibleSectionProps {
  title: string
  defaultExpanded?: boolean
  children: ReactNode
}

const styles = {
  header: {
    padding: UI_SPACE.section - 2,
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  content: {
    padding: UI_SPACE.section - 2,
    paddingTop: UI_SPACE.control - 2,
  } as ViewStyle,
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
    <Card bordered>
      <Pressable onPress={toggleExpanded}>
        <XStack
          style={styles.header}
          bg="$backgroundHover"
          borderTopLeftRadius="$surface"
          borderTopRightRadius="$surface"
          borderBottomLeftRadius={isExpanded ? 0 : "$surface"}
          borderBottomRightRadius={isExpanded ? 0 : "$surface"}
        >
          <Text fontWeight="bold" fontSize="$label">
            {title}
          </Text>
          {isExpanded ? (
            <ChevronUp size={20} color="$color" />
          ) : (
            <ChevronDown size={20} color="$color" />
          )}
        </XStack>
      </Pressable>

      {isExpanded && <YStack style={styles.content}>{children}</YStack>}
    </Card>
  )
})

export type { CollapsibleSectionProps }
