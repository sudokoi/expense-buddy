import { memo } from "react"
import { ScrollView, Text, View } from "react-native"
import { Button } from "../ui/Button"
import { useTranslation } from "react-i18next"
import { formatDate } from "../../utils/date"
import { getMonthStartDate } from "../../utils/analytics/time"
import { UI_SPACE } from "../../constants/ui-tokens"

interface MonthSelectorProps {
  value: string | null
  onChange: (value: string | null) => void
  availableMonths: string[]
}

const layoutStyles = {
  scrollContent: {
    paddingHorizontal: UI_SPACE.micro / 2,
  },
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
      contentContainerStyle={layoutStyles.scrollContent}
    >
      <View className="mb-4 flex-row justify-center gap-2">
        <Button
          size="compact"
          className="px-3"
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
              size="compact"
              className="px-3"
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
