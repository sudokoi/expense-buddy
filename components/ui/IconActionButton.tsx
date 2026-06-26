import { Button, Text, View, useTheme } from "tamagui"
import { useCallback, useEffect, useRef, useState, ComponentProps } from "react"
import { StyleSheet } from "react-native"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import { UI_SPACE } from "../../constants/ui-tokens"

interface IconActionButtonProps {
  icon: ComponentProps<typeof Button>["icon"]
  onPress: () => void
  tooltip?: string
  disabled?: boolean
  accessibilityLabel?: string
  /** When true, the icon spins continuously to signal an in-progress action. */
  spinning?: boolean
}

/**
 * Wraps content in a continuously rotating view while `active` is true.
 * Used to communicate an in-progress action (e.g. a running sync). Wrapping the
 * whole button (rather than just the icon element) preserves Tamagui's themed
 * icon color/size injection.
 */
function SpinningIcon({
  active,
  children,
}: {
  active: boolean
  children: React.ReactNode
}) {
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
}: IconActionButtonProps) {
  const theme = useTheme()
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
        <Button
          chromeless
          size="$compact"
          icon={icon}
          onPress={handlePress}
          onLongPress={handleLongPress}
          disabled={disabled}
          aria-label={accessibilityLabel ?? tooltip}
        />
      </SpinningIcon>
      {showTooltip && tooltip && (
        <View style={styles.tooltipContainer} pointerEvents="none">
          <View style={[styles.tooltip, { backgroundColor: theme.color?.val }]}>
            <Text fontSize="$body" color="$background">
              {tooltip}
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  tooltipContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: UI_SPACE.micro,
    zIndex: 1000,
  },
  tooltip: {
    paddingHorizontal: UI_SPACE.control,
    paddingVertical: UI_SPACE.micro,
    borderRadius: 4,
  },
})
