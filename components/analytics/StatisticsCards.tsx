import { memo } from "react"
import { XStack, YStack, Card, Text, H4 } from "tamagui"
import { format, parseISO } from "date-fns"
import { ViewStyle, TextStyle } from "react-native"
import { AnalyticsStatistics } from "../../utils/analytics-calculations"
import { CARD_COLORS } from "../../constants/theme-colors"

interface StatisticsCardsProps {
  statistics: AnalyticsStatistics
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
}: StatisticsCardsProps) {
  const formatDate = (dateStr: string): string => {
    try {
      return format(parseISO(dateStr), "MMM d")
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
          >
            Total Spent
          </Text>
          <H4 style={styles.cardValue} color={CARD_COLORS.blue.accent}>
            ₹{statistics.totalSpending.toFixed(2)}
          </H4>
        </Card>

        <Card flex={1} bordered padding="$3" backgroundColor={CARD_COLORS.green.bg}>
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$2"
            color={CARD_COLORS.green.text}
          >
            Daily Avg
          </Text>
          <H4 style={styles.cardValue} color={CARD_COLORS.green.accent}>
            ₹{statistics.averageDaily.toFixed(2)}
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
          >
            Top Category
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
              ₹{statistics.highestCategory.amount.toFixed(2)}
            </Text>
          )}
        </Card>

        <Card flex={1} bordered padding="$3" backgroundColor={CARD_COLORS.purple.bg}>
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$2"
            color={CARD_COLORS.purple.text}
          >
            Peak Day
          </Text>
          <H4 style={styles.cardValue} color={CARD_COLORS.purple.accent}>
            {statistics.highestDay ? formatDate(statistics.highestDay.date) : "—"}
          </H4>
          {statistics.highestDay && (
            <Text fontSize="$2" color={CARD_COLORS.purple.text}>
              ₹{statistics.highestDay.amount.toFixed(2)}
            </Text>
          )}
        </Card>
      </XStack>
    </YStack>
  )
})

export type { StatisticsCardsProps }
