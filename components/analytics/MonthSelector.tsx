import { memo } from "react"
import { ScrollView, Text, View } from "react-native"
import { Button } from "../ui/Button"
import { useTranslation } from "react-i18next"
import { formatDate } from "../../utils/date"
import { getMonthStartDate } from "../../utils/analytics/time"

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
          variant={value === null ? "accent" : "outline"}
          onPress={() => onChange(null)}
          accessibilityState={{ selected: value === null }}
        >
          <Text>{t("common.all")}</Text>
        </Button>
        {availableMonths.map((monthKey) => {
          const isSelected = value === monthKey
          const label = formatDate(getMonthStartDate(monthKey), "MMM yyyy")
          return (
            <Button
              key={monthKey}
              size="chip"
              variant={isSelected ? "accent" : "outline"}
              onPress={() => onChange(monthKey)}
              accessibilityState={{ selected: isSelected }}
            >
              <Text>{label}</Text>
            </Button>
          )
        })}
      </View>
    </ScrollView>
  )
})

export type { MonthSelectorProps }
