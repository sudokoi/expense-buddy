import { Button, Text, View, useTheme } from "tamagui"
import { useCallback, useEffect, useRef, useState, ComponentProps } from "react"
import { StyleSheet } from "react-native"
import { UI_SPACE } from "../../constants/ui-tokens"

interface IconActionButtonProps {
  icon: ComponentProps<typeof Button>["icon"]
  onPress: () => void
  tooltip?: string
  disabled?: boolean
  accessibilityLabel?: string
}

export function IconActionButton({
  icon,
  onPress,
  tooltip,
  disabled,
  accessibilityLabel,
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
      <Button
        chromeless
        size="$compact"
        icon={icon}
        onPress={handlePress}
        onLongPress={handleLongPress}
        disabled={disabled}
        aria-label={accessibilityLabel ?? tooltip}
      />
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
