import { useState, ReactNode } from "react"
import { YStack, XStack, Text, Card } from "tamagui"
import { ChevronDown } from "@tamagui/lucide-icons"
import { Pressable, ViewStyle } from "react-native"
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from "react-native-reanimated"

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
 * Features animated height transition and chevron indicator
 */
export function CollapsibleSection({
  title,
  defaultExpanded = true,
  children,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const rotation = useSharedValue(defaultExpanded ? 180 : 0)

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
    rotation.value = withTiming(isExpanded ? 0 : 180, { duration: 200 })
  }

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

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
          <Animated.View style={chevronStyle}>
            <ChevronDown size={20} color="$color" />
          </Animated.View>
        </XStack>
      </Pressable>

      {isExpanded && <YStack style={styles.content}>{children}</YStack>}
    </Card>
  )
}

export type { CollapsibleSectionProps }
