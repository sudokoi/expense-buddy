import { memo } from "react"
import { XStack, Button } from "tamagui"
import { ScrollView, ViewStyle } from "react-native"
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
  container: {
    justifyContent: "center",
  } as ViewStyle,
  scrollContent: {
    paddingHorizontal: UI_SPACE.micro / 2,
  } as ViewStyle,
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
      <XStack gap="$control" mb="$gutter" style={layoutStyles.container}>
        <Button
          size="$compact"
          px="$section"
          themeInverse={value === null}
          bordered={value !== null}
          onPress={() => onChange(null)}
        >
          {t("common.all")}
        </Button>
        {availableMonths.map((monthKey) => {
          const isSelected = value === monthKey
          const label = formatDate(getMonthStartDate(monthKey), "MMM yyyy")
          return (
            <Button
              key={monthKey}
              size="$compact"
              px="$section"
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
