import { useState, useCallback, memo, useMemo } from "react"
import { YStack, H4, XStack, Text } from "tamagui"
import { ViewStyle, TextStyle } from "react-native"
import { TimeWindow } from "../../utils/analytics-calculations"
import { useAnalyticsData } from "../../hooks/use-analytics-data"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { TimeWindowSelector } from "../../components/analytics/TimeWindowSelector"
import { StatisticsCards } from "../../components/analytics/StatisticsCards"
import { CategoryFilter } from "../../components/analytics/CategoryFilter"
import {
  PaymentMethodFilter,
  PaymentMethodSelectionKey,
} from "../../components/analytics/PaymentMethodFilter"
import { PaymentInstrumentFilter } from "../../components/analytics/PaymentInstrumentFilter"
import { PieChartSection } from "../../components/analytics/PieChartSection"
import { PaymentMethodPieChart } from "../../components/analytics/PaymentMethodPieChart"
import { LineChartSection } from "../../components/analytics/LineChartSection"
import { PaymentInstrumentPieChart } from "../../components/analytics/PaymentInstrumentPieChart"
import type { PaymentInstrumentSelectionKey } from "../../utils/analytics-calculations"
import type { PaymentMethodType } from "../../types/expense"
import {
  PAYMENT_INSTRUMENT_METHODS,
  getActivePaymentInstruments,
} from "../../services/payment-instruments"

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

  // Local state for selected payment methods (empty = all methods)
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<
    PaymentMethodSelectionKey[]
  >([])

  // Local state for selected payment instruments (empty = all instruments)
  const [selectedPaymentInstruments, setSelectedPaymentInstruments] = useState<
    PaymentInstrumentSelectionKey[]
  >([])

  // Get analytics data from hook
  const {
    filteredExpenses,
    pieChartData,
    paymentMethodChartData,
    paymentInstrumentChartData,
    lineChartData,
    statistics,
    paymentInstruments,
    isLoading,
  } = useAnalyticsData(
    timeWindow,
    selectedCategories,
    selectedPaymentMethods,
    selectedPaymentInstruments
  )

  // Handle category selection from pie chart segment tap - memoized
  const handleCategorySelect = useCallback((category: string | null) => {
    if (category) {
      setSelectedCategories((prev) =>
        prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
      )
    }
  }, [])

  const handlePaymentInstrumentSelect = useCallback(
    (key: PaymentInstrumentSelectionKey | null) => {
      if (!key) {
        setSelectedPaymentInstruments([])
        return
      }

      setSelectedPaymentInstruments((prev) =>
        prev.length === 1 && prev[0] === key ? [] : [key]
      )
    },
    []
  )

  const selectedPaymentMethodForChart: PaymentMethodType | null =
    selectedPaymentMethods.length === 1 && selectedPaymentMethods[0] !== "__none__"
      ? (selectedPaymentMethods[0] as PaymentMethodType)
      : null

  const prunePaymentInstrumentSelection = useCallback(
    (
      nextSelectedPaymentMethods: PaymentMethodSelectionKey[],
      currentInstrumentSelection: PaymentInstrumentSelectionKey[]
    ): PaymentInstrumentSelectionKey[] => {
      if (currentInstrumentSelection.length === 0) return currentInstrumentSelection

      const active = getActivePaymentInstruments(paymentInstruments)
      const allowedMethods =
        nextSelectedPaymentMethods.length === 0
          ? new Set(PAYMENT_INSTRUMENT_METHODS)
          : new Set(
              PAYMENT_INSTRUMENT_METHODS.filter((m) =>
                nextSelectedPaymentMethods.includes(m as PaymentMethodSelectionKey)
              )
            )

      const allowedWithConfig = new Set<string>()
      for (const method of allowedMethods) {
        if (active.some((i) => i.method === method)) {
          allowedWithConfig.add(method)
        }
      }

      return currentInstrumentSelection.filter((key) => {
        const method = key.split("::")[0]
        return allowedWithConfig.has(method)
      })
    },
    [paymentInstruments]
  )

  const handlePaymentMethodsChange = useCallback(
    (next: PaymentMethodSelectionKey[]) => {
      setSelectedPaymentMethods(next)
      setSelectedPaymentInstruments((prev) => prunePaymentInstrumentSelection(next, prev))
    },
    [prunePaymentInstrumentSelection]
  )

  const handlePaymentMethodSelect = useCallback(
    (paymentMethodType: PaymentMethodType | null) => {
      handlePaymentMethodsChange(paymentMethodType ? [paymentMethodType] : [])
    },
    [handlePaymentMethodsChange]
  )

  const showPaymentInstrumentFilter = useMemo(() => {
    const active = getActivePaymentInstruments(paymentInstruments)
    const allowedMethods =
      selectedPaymentMethods.length === 0
        ? new Set(PAYMENT_INSTRUMENT_METHODS)
        : new Set(
            PAYMENT_INSTRUMENT_METHODS.filter((m) =>
              selectedPaymentMethods.includes(m as PaymentMethodSelectionKey)
            )
          )

    for (const method of PAYMENT_INSTRUMENT_METHODS) {
      if (!allowedMethods.has(method)) continue
      if (active.some((i) => i.method === method)) return true
    }
    return false
  }, [paymentInstruments, selectedPaymentMethods])

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

          <PaymentMethodFilter
            selected={selectedPaymentMethods}
            onChange={handlePaymentMethodsChange}
          />

          {/* Always show payment instrument filter so users can reset it */}
          {showPaymentInstrumentFilter && (
            <PaymentInstrumentFilter
              instruments={paymentInstruments}
              selectedPaymentMethods={selectedPaymentMethods}
              selected={selectedPaymentInstruments}
              onChange={setSelectedPaymentInstruments}
            />
          )}

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
              <PaymentMethodPieChart
                data={paymentMethodChartData}
                selectedPaymentMethod={selectedPaymentMethodForChart}
                onPaymentMethodSelect={handlePaymentMethodSelect}
              />
              <PaymentInstrumentPieChart
                data={paymentInstrumentChartData}
                selectedKey={
                  selectedPaymentInstruments.length === 1
                    ? selectedPaymentInstruments[0]
                    : null
                }
                onSelect={handlePaymentInstrumentSelect}
              />
              <LineChartSection data={lineChartData} />
            </>
          )}
        </>
      )}
    </ScreenContainer>
  )
}
