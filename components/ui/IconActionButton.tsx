import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import { UI_SPACE, UI_RADIUS } from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"

interface IconActionButtonProps {
  icon: ReactNode
  onPress: () => void
  tooltip?: string
  disabled?: boolean
  accessibilityLabel?: string
  /** When true, the icon spins continuously to signal an in-progress action. */
  spinning?: boolean
  /** Horizontal alignment of the tooltip relative to the button. Defaults to "right". */
  tooltipAlign?: "left" | "center" | "right"
}

/**
 * Wraps content in a continuously rotating view while `active` is true.
 */
function SpinningIcon({ active, children }: { active: boolean; children: ReactNode }) {
  const rotation = useSharedValue(0)

  useEffect(() => {
    if (active) {
      rotation.value = 0
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      )
    } else {
      cancelAnimation(rotation)
      rotation.value = 0
    }
    return () => {
      cancelAnimation(rotation)
    }
  }, [active, rotation])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  return <Animated.View style={animatedStyle}>{children}</Animated.View>
}

export function IconActionButton({
  icon,
  onPress,
  tooltip,
  disabled,
  accessibilityLabel,
  spinning = false,
  tooltipAlign = "right",
}: IconActionButtonProps) {
  const theme = useThemeColors()
  const [showTooltip, setShowTooltip] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hideTooltip = useCallback(() => {
    setShowTooltip(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleLongPress = useCallback(() => {
    if (!tooltip) return
    setShowTooltip(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(hideTooltip, 2000)
  }, [tooltip, hideTooltip])

  const handlePress = useCallback(() => {
    hideTooltip()
    onPress()
  }, [onPress, hideTooltip])

  return (
    <View>
      <SpinningIcon active={spinning}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          disabled={disabled}
          aria-label={accessibilityLabel ?? tooltip}
          className="items-center justify-center p-1"
        >
          {icon}
        </Pressable>
      </SpinningIcon>
      {showTooltip && tooltip && (
        <View
          style={[styles.tooltipContainer, tooltipContainerStyle[tooltipAlign]]}
          pointerEvents="none"
        >
          <View style={[styles.tooltip, { backgroundColor: theme.foreground }]}>
            <Text className="text-[13px] text-background">{tooltip}</Text>
          </View>
        </View>
      )}
    </View>
  )
}

const tooltipContainerStyle = {
  left: { left: 0, right: "auto" as const, alignItems: "flex-start" as const },
  center: {
    left: "50%" as const,
    right: "auto" as const,
    transform: [{ translateX: "-50%" as const }],
  },
  right: { right: 0, left: "auto" as const, alignItems: "flex-end" as const },
}

const styles = StyleSheet.create({
  tooltipContainer: {
    position: "absolute",
    top: "100%",
    paddingTop: UI_SPACE.micro,
    zIndex: 1000,
  },
  tooltip: {
    paddingHorizontal: UI_SPACE.control,
    paddingVertical: UI_SPACE.micro,
    borderRadius: UI_RADIUS.control,
    minWidth: 100,
  },
})
