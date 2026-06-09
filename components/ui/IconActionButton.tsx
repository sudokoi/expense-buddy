import React, { useCallback, useEffect, useRef, useState } from "react"
import { Button, Text, YStack } from "tamagui"

type IconActionButtonProps = Omit<React.ComponentProps<typeof Button>, "children"> & {
  tooltip: string
  tooltipDurationMs?: number
}

export function IconActionButton({
  tooltip,
  tooltipDurationMs = 2000,
  onLongPress,
  onPress,
  ...buttonProps
}: IconActionButtonProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressNextPressRef = useRef(false)

  const clearTooltipTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => clearTooltipTimer, [clearTooltipTimer])

  const showTooltip = useCallback(() => {
    if (!tooltip) return
    clearTooltipTimer()
    setTooltipVisible(true)
    timerRef.current = setTimeout(() => {
      setTooltipVisible(false)
      timerRef.current = null
    }, tooltipDurationMs)
  }, [clearTooltipTimer, tooltip, tooltipDurationMs])

  const handleLongPress = useCallback(
    (event: unknown) => {
      suppressNextPressRef.current = true
      showTooltip()
      onLongPress?.(event as never)
    },
    [onLongPress, showTooltip]
  )

  const handlePress = useCallback(
    (event: unknown) => {
      if (suppressNextPressRef.current) {
        suppressNextPressRef.current = false
        return
      }
      onPress?.(event as never)
    },
    [onPress]
  )

  return (
    <YStack position="relative">
      <Button {...buttonProps} onLongPress={handleLongPress} onPress={handlePress} />
      {tooltipVisible ? (
        <YStack
          position="absolute"
          b="100%"
          mb={4}
          bg="$color"
          px={6}
          py={2}
          rounded={4}
          style={{ zIndex: 100, alignSelf: "center" }}
          pointerEvents="none"
        >
          <Text fontSize="$caption" color="$background" whiteSpace="nowrap">
            {tooltip}
          </Text>
        </YStack>
      ) : null}
    </YStack>
  )
}
