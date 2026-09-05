import { memo, useMemo } from "react"
import { Pressable, Text, View } from "react-native"
import { Check } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { CollapsibleSection } from "./CollapsibleSection"
import type { PieChartDataItem } from "../../utils/analytics/aggregations"
import { formatCurrency } from "../../utils/currency"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { UI_ICON_SIZE } from "../../constants/ui-tokens"

interface CategoryBreakdownProps {
  data: PieChartDataItem[]
  currencyCode: string
  selectedCategories: string[]
  onCategorySelect: (category: string) => void
}

/** Ranked bars keep even small categories readable without relying on color or arc labels. */
export const CategoryBreakdown = memo(function CategoryBreakdown({
  data,
  currencyCode,
  selectedCategories,
  onCategorySelect,
}: CategoryBreakdownProps) {
  const { t, i18n } = useTranslation()
  const theme = useThemeColors()
  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language || "en-IN", {
        style: "percent",
        maximumFractionDigits: 1,
      }),
    [i18n.language]
  )

  return (
    <CollapsibleSection title={t("analytics.charts.category.title")}>
      {data.length === 0 ? (
        <View className="h-chart-empty items-center justify-center">
          <Text className="text-muted-foreground">
            {t("analytics.charts.common.noData")}
          </Text>
        </View>
      ) : (
        <View className="gap-1">
          <Text className="px-2 pb-2 text-xs text-muted-foreground">
            {t("analytics.charts.category.hint")}
          </Text>
          {data.map((item) => {
            const selected = selectedCategories.includes(item.category)
            const percentage = percentFormatter.format(item.percentage / 100)
            const amount = formatCurrency(item.value, currencyCode)
            return (
              <Pressable
                key={item.category}
                onPress={() => onCategorySelect(item.category)}
                accessibilityRole="button"
                accessibilityLabel={`${item.text}, ${amount}, ${percentage}`}
                accessibilityState={{ selected }}
                className="min-h-12 gap-2 rounded-control p-2 active:opacity-60"
                style={{ backgroundColor: selected ? theme.muted : theme.surface }}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 flex-row items-center gap-1">
                    {selected ? (
                      <Check size={UI_ICON_SIZE.small} color={theme.foreground} />
                    ) : null}
                    <Text className="flex-1 text-sm font-medium text-foreground">
                      {item.text}
                    </Text>
                  </View>
                  <View className="max-w-[60%] items-end">
                    <Text
                      className="text-right text-sm font-bold text-foreground"
                      style={{ fontVariant: ["tabular-nums"] }}
                    >
                      {amount}
                    </Text>
                    <Text className="text-xs text-muted-foreground">{percentage}</Text>
                  </View>
                </View>
                <View
                  className="h-1.5 overflow-hidden rounded-full bg-border"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <View
                    className="h-full rounded-full"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  />
                </View>
              </Pressable>
            )
          })}
        </View>
      )}
    </CollapsibleSection>
  )
})
