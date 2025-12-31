import { useState, ReactNode } from "react"
import { YStack, XStack, Text, Card } from "tamagui"
import { ChevronDown, ChevronUp } from "@tamagui/lucide-icons"
import { Pressable, ViewStyle } from "react-native"

interface CollapsibleSectionProps {
  title: string
  defaultExpanded?: boolean
  children: ReactNode
}

const styles = {
  header: {
    padding: 12,
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  content: {
    padding: 12,
    paddingTop: 8,
  } as ViewStyle,
}

/**
 * CollapsibleSection - Reusable wrapper with expand/collapse toggle
 * Features static chevron indicator that changes direction based on state
 */
export function CollapsibleSection({
  title,
  defaultExpanded = true,
  children,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <Card bordered style={{ marginBottom: 16 }}>
      <Pressable onPress={toggleExpanded}>
        <XStack
          style={styles.header}
          bg="$backgroundHover"
          borderTopLeftRadius="$4"
          borderTopRightRadius="$4"
          borderBottomLeftRadius={isExpanded ? 0 : "$4"}
          borderBottomRightRadius={isExpanded ? 0 : "$4"}
        >
          <Text fontWeight="bold" fontSize="$4">
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
}

export type { CollapsibleSectionProps }
