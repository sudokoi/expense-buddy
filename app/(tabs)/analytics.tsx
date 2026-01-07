import { useState, useCallback, memo } from "react"
import { YStack, H4, XStack, Text } from "tamagui"
import { ViewStyle, TextStyle } from "react-native"
import { TimeWindow } from "../../utils/analytics-calculations"
import { useAnalyticsData } from "../../hooks/use-analytics-data"
import { ScreenContainer } from "../../components/ui"
import { TimeWindowSelector } from "../../components/analytics/TimeWindowSelector"
import { StatisticsCards } from "../../components/analytics/StatisticsCards"
import { CategoryFilter } from "../../components/analytics/CategoryFilter"
import { PieChartSection } from "../../components/analytics/PieChartSection"
import { PaymentMethodPieChart } from "../../components/analytics/PaymentMethodPieChart"
import { LineChartSection } from "../../components/analytics/LineChartSection"

const styles = {
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  } as ViewStyle,
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  } as ViewStyle,
  emptyText: {
    textAlign: "center",
  } as TextStyle,
  emptySubtext: {
    textAlign: "center",
    marginTop: 8,
  } as TextStyle,
}

// Memoized empty state component
const EmptyState = memo(function EmptyState({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <YStack style={styles.emptyContainer}>
      <Text color="$color" opacity={0.6} style={styles.emptyText}>
        {title}
      </Text>
      <Text color="$color" opacity={0.4} style={styles.emptySubtext}>
        {subtitle}
      </Text>
    </YStack>
  )
})

// Memoized header component
const Header = memo(function Header() {
  return (
    <XStack style={styles.headerRow}>
      <YStack>
        <H4>Analytics</H4>
        <Text color="$color" opacity={0.6}>
          Track your spending patterns
        </Text>
      </YStack>
    </XStack>
  )
})

/**
 * Analytics Tab Screen
 * Displays expense analytics with pie charts, line charts, and statistics
 * Supports time window selection and category filtering
 */
export default function AnalyticsScreen() {
  // Local state for time window (defaults to 7d per requirement 1.3)
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("7d")

  // Local state for selected categories (empty = all categories)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Get analytics data from hook
  const {
    filteredExpenses,
    pieChartData,
    paymentMethodChartData,
    lineChartData,
    statistics,
    isLoading,
  } = useAnalyticsData(timeWindow, selectedCategories)

  // Handle category selection from pie chart segment tap - memoized
  const handleCategorySelect = useCallback((category: string | null) => {
    if (category) {
      setSelectedCategories((prev) =>
        prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
      )
    }
  }, [])

  // Check if there's any data to display
  const hasData = filteredExpenses.length > 0
  const hasAnyExpenses = pieChartData.length > 0 || lineChartData.some((d) => d.value > 0)

  return (
    <ScreenContainer>
      <Header />
      <TimeWindowSelector value={timeWindow} onChange={setTimeWindow} />

      {isLoading ? (
        <EmptyState title="Loading analytics..." subtitle="" />
      ) : (
        <>
          {/* Always show category filter so users can reset it */}
          <CategoryFilter
            selectedCategories={selectedCategories}
            onChange={setSelectedCategories}
          />

          {!hasAnyExpenses ? (
            <EmptyState
              title="No expenses recorded in this period."
              subtitle="Try selecting a different time window or add some expenses."
            />
          ) : !hasData && selectedCategories.length > 0 ? (
            <EmptyState
              title="No expenses in selected categories."
              subtitle="Try selecting different categories or tap 'All' to reset."
            />
          ) : (
            <>
              <StatisticsCards statistics={statistics} />
              <PieChartSection
                data={pieChartData}
                onCategorySelect={handleCategorySelect}
              />
              <PaymentMethodPieChart data={paymentMethodChartData} />
              <LineChartSection data={lineChartData} />
            </>
          )}
        </>
      )}
    </ScreenContainer>
  )
}
