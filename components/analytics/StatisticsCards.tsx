import { memo } from "react"
import { Text, View } from "react-native"
import { Card } from "../ui/Card"
import { formatDate } from "../../utils/date"
import { formatCurrency } from "../../utils/currency"
import type { AnalyticsStatistics } from "../../utils/analytics/statistics"
import { useTranslation } from "react-i18next"

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
  return (
    <Card className="mb-4 gap-4 p-4">
      <View className="gap-1">
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
      <View className="flex-row flex-wrap gap-4 border-t border-border pt-3">
        <View className="min-w-[120px] flex-1 gap-1">
          <Text className="text-xs text-muted-foreground">
            {t("analytics.stats.dailyAvg")}
          </Text>
          <Text
            className="text-base font-semibold text-foreground"
            style={amountTextStyle}
          >
            {formatCurrency(statistics.averageDaily, currencyCode)}
          </Text>
        </View>
        <View className="min-w-[120px] flex-1 gap-1">
          <Text className="text-xs text-muted-foreground">
            {t("analytics.stats.topCategory")}
          </Text>
          <Text className="text-base font-semibold text-foreground">
            {statistics.highestCategory?.category === "Other"
              ? t("settings.categories.other")
              : (statistics.highestCategory?.category ?? "—")}
          </Text>
          {statistics.highestCategory ? (
            <Text className="text-xs text-muted-foreground">
              {formatCurrency(statistics.highestCategory.amount, currencyCode)}
            </Text>
          ) : null}
        </View>
      </View>
      {statistics.highestDay ? (
        <View className="flex-row flex-wrap justify-between gap-2 border-t border-border pt-3">
          <Text className="text-xs text-muted-foreground">
            {t("analytics.stats.peakDay")} ·{" "}
            {formatDate(statistics.highestDay.date, "PP")}
          </Text>
          <Text className="text-xs font-semibold text-foreground" style={amountTextStyle}>
            {formatCurrency(statistics.highestDay.amount, currencyCode)}
          </Text>
        </View>
      ) : null}
    </Card>
  )
})

export type { StatisticsCardsProps }
