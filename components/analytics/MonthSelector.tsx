import { memo } from "react"
import { ScrollView, Text, View } from "react-native"
import { Button } from "../ui/Button"
import { useTranslation } from "react-i18next"
import { formatDate } from "../../utils/date"
import { getMonthStartDate } from "../../utils/analytics/time"
import { useThemeColors } from "../../hooks/use-theme-colors"

interface MonthSelectorProps {
  value: string | null
  onChange: (value: string | null) => void
  availableMonths: string[]
}

export const MonthSelector = memo(function MonthSelector({
  value,
  onChange,
  availableMonths,
}: MonthSelectorProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      className="mb-5"
      contentContainerStyle={{ paddingHorizontal: 4 }}
    >
      <View className="flex-row gap-2">
        <Button
          size="chip"
          variant="outline"
          style={value === null ? { backgroundColor: theme.accent } : undefined}
          onPress={() => onChange(null)}
          accessibilityState={{ selected: value === null }}
        >
          <Text
            className="text-foreground"
            adjustsFontSizeToFit
            numberOfLines={1}
            style={value === null ? { color: theme.accentForeground } : undefined}
          >
            {t("common.all")}
          </Text>
        </Button>
        {availableMonths.map((monthKey) => {
          const isSelected = value === monthKey
          const label = formatDate(getMonthStartDate(monthKey), "MMM yyyy")
          return (
            <Button
              key={monthKey}
              size="chip"
              variant="outline"
              style={isSelected ? { backgroundColor: theme.accent } : undefined}
              onPress={() => onChange(monthKey)}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                className="text-foreground"
                adjustsFontSizeToFit
                numberOfLines={1}
                style={isSelected ? { color: theme.accentForeground } : undefined}
              >
                {label}
              </Text>
            </Button>
          )
        })}
      </View>
    </ScrollView>
  )
})

export type { MonthSelectorProps }
