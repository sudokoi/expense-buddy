import { memo, useCallback } from "react"
import { ScrollView, Text, View } from "react-native"
import { Button } from "../ui/Button"
import type { TimeWindow } from "../../utils/analytics/time"
import { useTranslation } from "react-i18next"
import { UI_SPACE } from "../../constants/ui-tokens"

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
  scrollContent: {
    paddingHorizontal: UI_SPACE.micro / 2,
  },
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
      <View className="mb-4 flex-row justify-center gap-2">
        {TIME_WINDOWS.map((window) => {
          const isSelected = value === window.value
          return (
            <Button
              key={window.value}
              size="compact"
              className="px-3"
              variant={isSelected ? "accent" : "outline"}
              onPress={() => handlePress(window.value)}
              accessibilityState={{ selected: isSelected }}
            >
              <Text>{t(`analytics.timeWindow.${window.value}`)}</Text>
            </Button>
          )
        })}
      </View>
    </ScrollView>
  )
})

export type { TimeWindowSelectorProps }
