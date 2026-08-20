import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, Text, View } from "react-native"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import { LucideProvider } from "lucide-react-native"
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
      // Respect reduced motion — keep icon static if user prefers less animation
      // (react-native-reanimated still animates; we gate at JS seam)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      try {
        const { AccessibilityInfo } = require("react-native")
        void AccessibilityInfo.isReduceMotionEnabled?.().then((enabled: boolean) => {
          if (enabled) return
          rotation.value = 0
          rotation.value = withRepeat(
            withTiming(360, { duration: 1000, easing: Easing.linear }),
            -1,
            false
          )
        })
        // Fallback: start animation immediately (async check may be slower)
        rotation.value = 0
        rotation.value = withRepeat(
          withTiming(360, { duration: 1000, easing: Easing.linear }),
          -1,
          false
        )
      } catch {
        rotation.value = 0
        rotation.value = withRepeat(
          withTiming(360, { duration: 1000, easing: Easing.linear }),
          -1,
          false
        )
      }
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
          hitSlop={8}
          aria-label={accessibilityLabel ?? tooltip}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!disabled }}
          className="items-center justify-center p-2"
        >
          <LucideProvider color={theme.foreground}>{icon}</LucideProvider>
        </Pressable>
      </SpinningIcon>
      {showTooltip && tooltip && (
        <View
          className="absolute z-[1000] pt-1"
          style={[{ top: "100%" }, tooltipContainerStyle[tooltipAlign]]}
          pointerEvents="none"
        >
          <View
            className="px-2 py-1 rounded-control"
            style={{ minWidth: 100, backgroundColor: theme.foreground }}
          >
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
