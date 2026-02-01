import { memo, useMemo } from "react"
import { XStack, Button } from "tamagui"
import { ScrollView, ViewStyle } from "react-native"
import { useTranslation } from "react-i18next"
import { formatDate } from "../../utils/date"
import { getMonthStartDate } from "../../utils/analytics/time"

interface MonthSelectorProps {
  value: string | null
  onChange: (value: string | null) => void
  maxMonths?: number
}

const layoutStyles = {
  container: {
    justifyContent: "center",
  } as ViewStyle,
  scrollContent: {
    paddingHorizontal: 2,
  } as ViewStyle,
}

function getMonthOptions(count: number, now: Date): string[] {
  const months: string[] = []
  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    months.push(key)
  }
  return months
}

export const MonthSelector = memo(function MonthSelector({
  value,
  onChange,
  maxMonths = 12,
}: MonthSelectorProps) {
  const { t } = useTranslation()
  const months = useMemo(() => getMonthOptions(maxMonths, new Date()), [maxMonths])

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={layoutStyles.scrollContent}
    >
      <XStack gap="$2" mb="$4" style={layoutStyles.container}>
        <Button
          size="$3"
          themeInverse={value === null}
          bordered={value !== null}
          onPress={() => onChange(null)}
        >
          {t("common.all")}
        </Button>
        {months.map((monthKey) => {
          const isSelected = value === monthKey
          const label = formatDate(getMonthStartDate(monthKey), "MMM yyyy")
          return (
            <Button
              key={monthKey}
              size="$3"
              themeInverse={isSelected}
              bordered={!isSelected}
              onPress={() => onChange(monthKey)}
            >
              {label}
            </Button>
          )
        })}
      </XStack>
    </ScrollView>
  )
})

export type { MonthSelectorProps }
