import { memo } from "react"
import { XStack, YStack, Card, Text, H4 } from "tamagui"

import { parseISO } from "date-fns"
import { formatDate } from "../../utils/date"
import { getCurrencySymbol } from "../../utils/currency"
import { ViewStyle, TextStyle } from "react-native"
import { AnalyticsStatistics } from "../../utils/analytics-calculations"
import { CARD_COLORS } from "../../constants/theme-colors"
import { useTranslation } from "react-i18next"

interface StatisticsCardsProps {
  statistics: AnalyticsStatistics
  currencyCode?: string
}

const styles = {
  container: {
    gap: 12,
    marginBottom: 16,
  } as ViewStyle,
  row: {
    gap: 12,
  } as ViewStyle,
  cardValue: {
    marginTop: 8,
  } as TextStyle,
}

/**
 * StatisticsCards - Display four summary cards in a 2x2 grid
 * Shows total spending, average daily, highest category, and highest day
 */
export const StatisticsCards = memo(function StatisticsCards({
  statistics,
  currencyCode = "INR",
}: StatisticsCardsProps) {
  const { t } = useTranslation()
  const symbol = getCurrencySymbol(currencyCode)

  // ...

  const formatDateStr = (dateStr: string): string => {
    try {
      return formatDate(parseISO(dateStr), "MMM d")
    } catch {
      return dateStr
    }
  }

  return (
    <YStack style={styles.container}>
      {/* First row */}
      <XStack style={styles.row}>
        <Card flex={1} bordered padding="$3" backgroundColor={CARD_COLORS.blue.bg}>
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$2"
            color={CARD_COLORS.blue.text}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {t("analytics.stats.totalSpent")}
          </Text>
          <H4
            style={styles.cardValue}
            color={CARD_COLORS.blue.accent}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {symbol}
            {statistics.totalSpending.toFixed(2)}
          </H4>
        </Card>

        <Card flex={1} bordered padding="$3" backgroundColor={CARD_COLORS.green.bg}>
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$2"
            color={CARD_COLORS.green.text}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {t("analytics.stats.dailyAvg")}
          </Text>
          <H4
            style={styles.cardValue}
            color={CARD_COLORS.green.accent}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {symbol}
            {statistics.averageDaily.toFixed(2)}
          </H4>
        </Card>
      </XStack>

      {/* Second row */}
      <XStack style={styles.row}>
        <Card flex={1} bordered padding="$3" backgroundColor={CARD_COLORS.orange.bg}>
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$2"
            color={CARD_COLORS.orange.text}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {t("analytics.stats.topCategory")}
          </Text>
          <H4
            style={styles.cardValue}
            color={CARD_COLORS.orange.accent}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {statistics.highestCategory?.category ?? "—"}
          </H4>
          {statistics.highestCategory && (
            <Text fontSize="$2" color={CARD_COLORS.orange.text}>
              {symbol}
              {statistics.highestCategory.amount.toFixed(2)}
            </Text>
          )}
        </Card>

        <Card flex={1} bordered padding="$3" backgroundColor={CARD_COLORS.purple.bg}>
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$2"
            color={CARD_COLORS.purple.text}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {t("analytics.stats.peakDay")}
          </Text>
          <H4
            style={styles.cardValue}
            color={CARD_COLORS.purple.accent}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {statistics.highestDay ? formatDateStr(statistics.highestDay.date) : "—"}
          </H4>
          {statistics.highestDay && (
            <Text fontSize="$2" color={CARD_COLORS.purple.text}>
              {symbol}
              {statistics.highestDay.amount.toFixed(2)}
            </Text>
          )}
        </Card>
      </XStack>
    </YStack>
  )
})

export type { StatisticsCardsProps }
