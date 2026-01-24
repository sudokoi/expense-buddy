import { XStack, Button } from "tamagui"
import { memo, useCallback } from "react"
import { ScrollView, ViewStyle } from "react-native"
import { TimeWindow } from "../../utils/analytics-calculations"
import { useTranslation } from "react-i18next"

interface TimeWindowSelectorProps {
  value: TimeWindow
  onChange: (value: TimeWindow) => void
}

const TIME_WINDOWS: { label: string; value: TimeWindow }[] = [
  { label: "7 Days", value: "7d" },
  { label: "15 Days", value: "15d" },
  { label: "1 Month", value: "1m" },
  { label: "3 Months", value: "3m" },
  { label: "6 Months", value: "6m" },
  { label: "1 Year", value: "1y" },
  { label: "All", value: "all" },
]

const layoutStyles = {
  container: {
    justifyContent: "center",
  } as ViewStyle,
  scrollContent: {
    paddingHorizontal: 2,
  } as ViewStyle,
}

/**
 * TimeWindowSelector - Toggle buttons for selecting analytics time window
 * Provides 7d, 15d, 1m, 3m, 6m, 1y, and all options with visual feedback for selection
 * Memoized to prevent unnecessary re-renders
 */
export const TimeWindowSelector = memo(function TimeWindowSelector({
  value,
  onChange,
}: TimeWindowSelectorProps) {
  const { t } = useTranslation()

  const handlePress = useCallback(
    (windowValue: TimeWindow) => {
      onChange(windowValue)
    },
    [onChange]
  )

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={layoutStyles.scrollContent}
    >
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
              {t(`analytics.timeWindow.${window.value}`)}
            </Button>
          )
        })}
      </XStack>
    </ScrollView>
  )
})

export type { TimeWindowSelectorProps }
