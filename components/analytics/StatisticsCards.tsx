import { memo } from "react"
import { Text, View } from "react-native"
import { Card } from "../ui/Card"
import { parseISO } from "date-fns"
import { formatDate } from "../../utils/date"
import { getCurrencySymbol } from "../../utils/currency"
import type { AnalyticsStatistics } from "../../utils/analytics/statistics"
import { CARD_COLORS } from "../../constants/theme-colors"
import { useTranslation } from "react-i18next"

interface StatisticsCardsProps {
  statistics: AnalyticsStatistics
  currencyCode?: string
  /** Full-period (grand) total ignoring all filters, shown as subtext */
  fullPeriodTotalSpending?: number
  /** Show the subtext whenever any filter is active (not the default/reset state) */
  hasActiveFilters?: boolean
}

/**
 * StatisticsCards - Display four summary cards in a 2x2 grid
 * Shows total spending, average daily, highest category, and highest day
 */
export const StatisticsCards = memo(function StatisticsCards({
  statistics,
  currencyCode = "INR",
  fullPeriodTotalSpending,
  hasActiveFilters = false,
}: StatisticsCardsProps) {
  const { t } = useTranslation()
  const symbol = getCurrencySymbol(currencyCode)

  // Show the subtext whenever any filter narrows the data below the full-period
  // total. In the default/reset state (no active filters) the headline already
  // equals the full-period total, so the subtext would just repeat it.
  const showSubtext = hasActiveFilters && fullPeriodTotalSpending !== undefined

  const formatDateStr = (dateStr: string): string => {
    try {
      return formatDate(parseISO(dateStr), "MMM d")
    } catch {
      return dateStr
    }
  }

  return (
    <View className="mb-4 gap-3">
      {/* First row */}
      <View className="flex-row gap-3">
        <Card className="flex-1 p-3" style={{ backgroundColor: CARD_COLORS.blue.bg }}>
          <Text
            className="text-xs font-bold uppercase"
            style={{ color: CARD_COLORS.blue.text }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {t("analytics.stats.totalSpent")}
          </Text>
          <Text
            className="mt-2 text-lg font-semibold"
            style={{ color: CARD_COLORS.blue.accent }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {symbol}
            {statistics.totalSpending.toFixed(2)}
          </Text>
          {showSubtext && (
            <Text
              className="text-xs"
              style={{ color: CARD_COLORS.blue.text }}
              numberOfLines={1}
            >
              {t("analytics.stats.ofTotal", {
                total: `${symbol}${fullPeriodTotalSpending!.toFixed(2)}`,
              })}
            </Text>
          )}
        </Card>

        <Card className="flex-1 p-3" style={{ backgroundColor: CARD_COLORS.green.bg }}>
          <Text
            className="text-xs font-bold uppercase"
            style={{ color: CARD_COLORS.green.text }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {t("analytics.stats.dailyAvg")}
          </Text>
          <Text
            className="mt-2 text-lg font-semibold"
            style={{ color: CARD_COLORS.green.accent }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {symbol}
            {statistics.averageDaily.toFixed(2)}
          </Text>
          {showSubtext && (
            <Text
              className="text-xs"
              style={{ color: CARD_COLORS.green.text }}
              numberOfLines={1}
            >
              {t("analytics.stats.ofTotal", {
                total: `${symbol}${fullPeriodTotalSpending!.toFixed(2)}`,
              })}
            </Text>
          )}
        </Card>
      </View>

      {/* Second row */}
      <View className="flex-row gap-3">
        <Card className="flex-1 p-3" style={{ backgroundColor: CARD_COLORS.orange.bg }}>
          <Text
            className="text-xs font-bold uppercase"
            style={{ color: CARD_COLORS.orange.text }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {t("analytics.stats.topCategory")}
          </Text>
          <Text
            className="mt-2 text-lg font-semibold"
            style={{ color: CARD_COLORS.orange.accent }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {statistics.highestCategory?.category === "Other"
              ? t("settings.categories.other")
              : (statistics.highestCategory?.category ?? "—")}
          </Text>
          {statistics.highestCategory && (
            <Text className="text-xs" style={{ color: CARD_COLORS.orange.text }}>
              {symbol}
              {statistics.highestCategory.amount.toFixed(2)}
            </Text>
          )}
          {showSubtext && (
            <Text
              className="text-xs"
              style={{ color: CARD_COLORS.orange.text }}
              numberOfLines={1}
            >
              {t("analytics.stats.ofTotal", {
                total: `${symbol}${fullPeriodTotalSpending!.toFixed(2)}`,
              })}
            </Text>
          )}
        </Card>

        <Card className="flex-1 p-3" style={{ backgroundColor: CARD_COLORS.purple.bg }}>
          <Text
            className="text-xs font-bold uppercase"
            style={{ color: CARD_COLORS.purple.text }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {t("analytics.stats.peakDay")}
          </Text>
          <Text
            className="mt-2 text-lg font-semibold"
            style={{ color: CARD_COLORS.purple.accent }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {statistics.highestDay ? formatDateStr(statistics.highestDay.date) : "—"}
          </Text>
          {statistics.highestDay && (
            <Text className="text-xs" style={{ color: CARD_COLORS.purple.text }}>
              {symbol}
              {statistics.highestDay.amount.toFixed(2)}
            </Text>
          )}
          {showSubtext && (
            <Text
              className="text-xs"
              style={{ color: CARD_COLORS.purple.text }}
              numberOfLines={1}
            >
              {t("analytics.stats.ofTotal", {
                total: `${symbol}${fullPeriodTotalSpending!.toFixed(2)}`,
              })}
            </Text>
          )}
        </Card>
      </View>
    </View>
  )
})

export type { StatisticsCardsProps }
