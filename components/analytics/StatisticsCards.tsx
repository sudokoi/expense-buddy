import { memo } from "react"
import { XStack, YStack, Card, Text, H4, useTheme } from "tamagui"
import { format, parseISO } from "date-fns"
import { ViewStyle, TextStyle } from "react-native"
import { AnalyticsStatistics } from "../../utils/analytics-calculations"

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
  const theme = useTheme()

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
        <Card
          flex={1}
          bordered
          animation="bouncy"
          hoverStyle={{ scale: 1.02 }}
          padding="$3"
          backgroundColor={theme.blue3}
        >
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$2"
            color={theme.blue11}
          >
            Total Spent
          </Text>
          <H4 style={styles.cardValue} color={theme.blue12}>
            ₹{statistics.totalSpending.toFixed(2)}
          </H4>
        </Card>

        <Card
          flex={1}
          bordered
          animation="bouncy"
          hoverStyle={{ scale: 1.02 }}
          padding="$3"
          backgroundColor={theme.green3}
        >
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$2"
            color={theme.green11}
          >
            Daily Avg
          </Text>
          <H4 style={styles.cardValue} color={theme.green12}>
            ₹{statistics.averageDaily.toFixed(2)}
          </H4>
        </Card>
      </XStack>

      {/* Second row */}
      <XStack style={styles.row}>
        <Card
          flex={1}
          bordered
          animation="bouncy"
          hoverStyle={{ scale: 1.02 }}
          padding="$3"
          backgroundColor={theme.orange3}
        >
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$2"
            color={theme.orange11}
          >
            Top Category
          </Text>
          <H4 style={styles.cardValue} color={theme.orange12}>
            {statistics.highestCategory?.category ?? "—"}
          </H4>
          {statistics.highestCategory && (
            <Text fontSize="$2" color={theme.orange11}>
              ₹{statistics.highestCategory.amount.toFixed(2)}
            </Text>
          )}
        </Card>

        <Card
          flex={1}
          bordered
          animation="bouncy"
          hoverStyle={{ scale: 1.02 }}
          padding="$3"
          backgroundColor={theme.purple3}
        >
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$2"
            color={theme.purple11}
          >
            Peak Day
          </Text>
          <H4 style={styles.cardValue} color={theme.purple12}>
            {statistics.highestDay ? formatDate(statistics.highestDay.date) : "—"}
          </H4>
          {statistics.highestDay && (
            <Text fontSize="$2" color={theme.purple11}>
              ₹{statistics.highestDay.amount.toFixed(2)}
            </Text>
          )}
        </Card>
      </XStack>
    </YStack>
  )
})

export type { StatisticsCardsProps }
