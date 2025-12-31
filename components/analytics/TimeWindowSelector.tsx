import { XStack, Button } from "tamagui"
import { memo, useCallback } from "react"
import { ViewStyle } from "react-native"
import { TimeWindow } from "../../utils/analytics-calculations"

interface TimeWindowSelectorProps {
  value: TimeWindow
  onChange: (value: TimeWindow) => void
}

const TIME_WINDOWS: { label: string; value: TimeWindow }[] = [
  { label: "7 Days", value: "7d" },
  { label: "15 Days", value: "15d" },
  { label: "1 Month", value: "1m" },
]

const layoutStyles = {
  container: {
    justifyContent: "center",
  } as ViewStyle,
}

/**
 * TimeWindowSelector - Toggle buttons for selecting analytics time window
 * Provides 7d, 15d, and 1m options with visual feedback for selection
 * Memoized to prevent unnecessary re-renders
 */
export const TimeWindowSelector = memo(function TimeWindowSelector({
  value,
  onChange,
}: TimeWindowSelectorProps) {
  const handlePress = useCallback(
    (windowValue: TimeWindow) => {
      onChange(windowValue)
    },
    [onChange]
  )

  return (
    <XStack gap="$2" mb="$4" style={layoutStyles.container}>
      {TIME_WINDOWS.map((window) => {
        const isSelected = value === window.value
        return (
          <Button
            key={window.value}
            size="$3"
            themeInverse={isSelected}
            bordered={!isSelected}
            onPress={() => handlePress(window.value)}
          >
            {window.label}
          </Button>
        )
      })}
    </XStack>
  )
})

export type { TimeWindowSelectorProps }
