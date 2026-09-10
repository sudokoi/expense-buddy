import { memo } from "react"
import { Text, View } from "react-native"
import { Card } from "../ui/Card"
import { formatDate } from "../../utils/date"
import { formatCurrency } from "../../utils/currency"
import type { AnalyticsStatistics } from "../../utils/analytics/statistics"
import { useTranslation } from "react-i18next"
import { CARD_COLORS } from "../../constants/palette"
import { useThemeScheme } from "../../hooks/use-theme-colors"

interface StatisticsCardsProps {
  statistics: AnalyticsStatistics
  currencyCode?: string
  periodLabel: string
  fullPeriodTotalSpending?: number
  hasActiveFilters?: boolean
}

const amountTextStyle = { fontVariant: ["tabular-nums" as const] }

export const StatisticsCards = memo(function StatisticsCards({
  statistics,
  currencyCode = "INR",
  periodLabel,
  fullPeriodTotalSpending,
  hasActiveFilters = false,
}: StatisticsCardsProps) {
  const { t } = useTranslation()
  const colors = CARD_COLORS[useThemeScheme()]
  return (
    <Card className="mb-ui-content overflow-hidden">
      <View className="gap-1 bg-muted p-ui-content">
        <Text className="text-sm text-muted-foreground">
          {t("analytics.stats.totalSpent")} · {periodLabel}
        </Text>
        <Text className="text-3xl font-semibold text-foreground" style={amountTextStyle}>
          {formatCurrency(statistics.totalSpending, currencyCode)}
        </Text>
        {hasActiveFilters && fullPeriodTotalSpending !== undefined ? (
          <Text className="text-xs text-muted-foreground">
            {t("analytics.stats.ofTotal", {
              total: formatCurrency(fullPeriodTotalSpending, currencyCode),
            })}
          </Text>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-ui-section p-ui-section">
        <View
          className="min-w-metric flex-1 gap-1 rounded-control p-ui-section"
          style={{ backgroundColor: colors.green.bg }}
        >
          <Text className="text-xs" style={{ color: colors.green.text }}>
            {t("analytics.stats.dailyAvg")}
          </Text>
          <Text
            className="text-base font-semibold"
            style={[amountTextStyle, { color: colors.green.text }]}
          >
            {formatCurrency(statistics.averageDaily, currencyCode)}
          </Text>
        </View>
        <View
          className="min-w-metric flex-1 gap-1 rounded-control p-ui-section"
          style={{ backgroundColor: colors.orange.bg }}
        >
          <Text className="text-xs" style={{ color: colors.orange.text }}>
            {t("analytics.stats.topCategory")}
          </Text>
          <Text className="text-base font-semibold" style={{ color: colors.orange.text }}>
            {statistics.highestCategory?.category === "Other"
              ? t("settings.categories.other")
              : (statistics.highestCategory?.category ?? "—")}
          </Text>
          {statistics.highestCategory ? (
            <Text className="text-xs" style={{ color: colors.orange.text }}>
              {formatCurrency(statistics.highestCategory.amount, currencyCode)}
            </Text>
          ) : null}
        </View>
      </View>
      {statistics.highestDay ? (
        <View
          className="mx-ui-section mb-ui-section flex-row flex-wrap justify-between gap-ui-control rounded-control p-ui-section"
          style={{ backgroundColor: colors.purple.bg }}
        >
          <Text className="text-xs" style={{ color: colors.purple.text }}>
            {t("analytics.stats.peakDay")} ·{" "}
            {formatDate(statistics.highestDay.date, "PP")}
          </Text>
          <Text
            className="text-xs font-semibold"
            style={[amountTextStyle, { color: colors.purple.text }]}
          >
            {formatCurrency(statistics.highestDay.amount, currencyCode)}
          </Text>
        </View>
      ) : null}
    </Card>
  )
})

export type { StatisticsCardsProps }
