import { useState, useCallback, memo, useMemo } from "react"
import { YStack, H4, XStack, Text, Button, ScrollView } from "tamagui"
import { ViewStyle, TextStyle } from "react-native"
import { TimeWindow } from "../../utils/analytics-calculations"
import { useAnalyticsData } from "../../hooks/use-analytics-data"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { StatisticsCards } from "../../components/analytics/StatisticsCards"
import type { PaymentMethodSelectionKey } from "../../components/analytics/PaymentMethodFilter"
import { PieChartSection } from "../../components/analytics/PieChartSection"
import { PaymentMethodPieChart } from "../../components/analytics/PaymentMethodPieChart"
import { LineChartSection } from "../../components/analytics/LineChartSection"
import { PaymentInstrumentPieChart } from "../../components/analytics/PaymentInstrumentPieChart"
import type { PaymentInstrumentSelectionKey } from "../../utils/analytics-calculations"
import type { PaymentMethodType } from "../../types/expense"
import {
  PAYMENT_INSTRUMENT_METHODS,
  findInstrumentById,
  formatPaymentInstrumentLabel,
  getActivePaymentInstruments,
} from "../../services/payment-instruments"
import { AnalyticsFiltersSheet } from "../../components/analytics/AnalyticsFiltersSheet"
import { SlidersHorizontal } from "@tamagui/lucide-icons"
import type { PaymentInstrument } from "../../types/payment-instrument"
import { PAYMENT_METHODS } from "../../constants/payment-methods"

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

const TIME_WINDOW_LABELS: Record<TimeWindow, string> = {
  "7d": "7 Days",
  "15d": "15 Days",
  "1m": "1 Month",
  all: "All",
}

const INSTRUMENT_OTHERS_ID = "__others__"

function methodShortLabel(method: string): string {
  switch (method) {
    case "Credit Card":
      return "CC"
    case "Debit Card":
      return "DC"
    case "UPI":
      return "UPI"
    default:
      return method
  }
}

function formatSelectedPaymentInstrumentLabel(
  key: PaymentInstrumentSelectionKey,
  instruments: PaymentInstrument[]
): string {
  const [method, instrumentId] = key.split("::")
  const shortMethod = methodShortLabel(method)

  if (!instrumentId || instrumentId === INSTRUMENT_OTHERS_ID) {
    return `${shortMethod} • Others`
  }

  const inst = findInstrumentById(instruments, instrumentId)
  if (!inst || inst.deletedAt) {
    return `${shortMethod} • Others`
  }

  return `${shortMethod} • ${formatPaymentInstrumentLabel(inst)}`
}

function formatSelectedPaymentInstrumentsSummary(
  keys: PaymentInstrumentSelectionKey[]
): string {
  if (keys.length === 0) return "All"
  if (keys.length === 1) return "1"

  const countsByMethod = new Map<string, number>()
  for (const key of keys) {
    const [method] = key.split("::")
    const short = methodShortLabel(method)
    countsByMethod.set(short, (countsByMethod.get(short) ?? 0) + 1)
  }

  const parts = Array.from(countsByMethod.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([method, count]) => `${method} ${count}`)

  const MAX_GROUPS = 3
  const visible = parts.slice(0, MAX_GROUPS)
  const remaining = parts.length - visible.length
  const breakdown =
    remaining > 0 ? `${visible.join(", ")}, +${remaining}` : visible.join(", ")

  return `${keys.length} (${breakdown})`
}

function formatListBreakdown(items: string[]): string {
  const MAX_ITEMS = 3

  const unique = Array.from(new Set(items)).sort((a, b) => a.localeCompare(b))
  const visible = unique.slice(0, MAX_ITEMS)
  const remaining = unique.length - visible.length

  if (unique.length === 0) return "All"
  if (unique.length === 1) return unique[0]

  return remaining > 0 ? `${visible.join(", ")}, +${remaining}` : visible.join(", ")
}

function paymentMethodLabel(key: PaymentMethodSelectionKey): string {
  if (key === "__none__") return "None"
  const match = PAYMENT_METHODS.find((m) => m.value === key)
  return match?.label ?? key
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

  // Filters sheet open state
  const [filtersOpen, setFiltersOpen] = useState(false)

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
      setSelectedPaymentInstruments((prev) => {
        // When payment methods are reset to "All", reset instruments to "All" too.
        if (next.length === 0) return []
        return prunePaymentInstrumentSelection(next, prev)
      })
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

  const activeFilterCount =
    (timeWindow !== "7d" ? 1 : 0) +
    (selectedCategories.length > 0 ? 1 : 0) +
    (selectedPaymentMethods.length > 0 ? 1 : 0) +
    (selectedPaymentInstruments.length > 0 ? 1 : 0)

  const appliedChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = []

    chips.push({ key: "time", label: `Time: ${TIME_WINDOW_LABELS[timeWindow]}` })

    if (selectedCategories.length === 0) {
      chips.push({ key: "category", label: "Category: All" })
    } else if (selectedCategories.length === 1) {
      chips.push({ key: "category", label: `Category: ${selectedCategories[0]}` })
    } else {
      chips.push({
        key: "category",
        label: `Categories: ${selectedCategories.length} (${formatListBreakdown(
          selectedCategories
        )})`,
      })
    }

    if (selectedPaymentMethods.length === 0) {
      chips.push({ key: "payment-method", label: "Payment: All" })
    } else if (selectedPaymentMethods.length === 1) {
      const only = selectedPaymentMethods[0]
      chips.push({ key: "payment-method", label: `Payment: ${paymentMethodLabel(only)}` })
    } else {
      chips.push({
        key: "payment-method",
        label: `Payment methods: ${selectedPaymentMethods.length} (${formatListBreakdown(
          selectedPaymentMethods.map(paymentMethodLabel)
        )})`,
      })
    }

    if (showPaymentInstrumentFilter) {
      if (selectedPaymentInstruments.length === 0) {
        chips.push({ key: "payment-instrument", label: "Instrument: All" })
      } else if (selectedPaymentInstruments.length === 1) {
        chips.push({
          key: "payment-instrument",
          label: `Instrument: ${formatSelectedPaymentInstrumentLabel(
            selectedPaymentInstruments[0],
            paymentInstruments
          )}`,
        })
      } else {
        chips.push({
          key: "payment-instrument",
          label: `Instruments: ${formatSelectedPaymentInstrumentsSummary(
            selectedPaymentInstruments
          )}`,
        })
      }
    }

    return chips
  }, [
    timeWindow,
    selectedCategories,
    selectedPaymentMethods,
    selectedPaymentInstruments,
    paymentInstruments,
    showPaymentInstrumentFilter,
  ])

  const handleApplyFilters = useCallback(
    (next: {
      timeWindow: TimeWindow
      selectedCategories: string[]
      selectedPaymentMethods: PaymentMethodSelectionKey[]
      selectedPaymentInstruments: PaymentInstrumentSelectionKey[]
    }) => {
      setTimeWindow(next.timeWindow)
      setSelectedCategories(next.selectedCategories)
      setSelectedPaymentMethods(next.selectedPaymentMethods)
      // When payment methods are reset to "All", ensure instruments reset too.
      setSelectedPaymentInstruments(
        next.selectedPaymentMethods.length === 0 ? [] : next.selectedPaymentInstruments
      )
      setFiltersOpen(false)
    },
    []
  )

  return (
    <ScreenContainer>
      <Header />

      <XStack
        mb="$4"
        gap="$2"
        style={{ alignItems: "center", justifyContent: "space-between" } as ViewStyle}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 } as any}
          flex={1}
        >
          {appliedChips.map((chip) => (
            <Button
              key={chip.key}
              size="$2"
              bordered
              onPress={() => setFiltersOpen(true)}
              style={{ borderRadius: 999 }}
            >
              <Button.Text numberOfLines={1}>{chip.label}</Button.Text>
            </Button>
          ))}
        </ScrollView>

        <Button
          size="$3"
          onPress={() => setFiltersOpen(true)}
          icon={SlidersHorizontal}
          bordered
        >
          {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
        </Button>
      </XStack>

      {isLoading ? (
        <EmptyState title="Loading analytics..." subtitle="" />
      ) : (
        <>
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

      <AnalyticsFiltersSheet
        open={filtersOpen}
        timeWindow={timeWindow}
        selectedCategories={selectedCategories}
        selectedPaymentMethods={selectedPaymentMethods}
        paymentInstruments={paymentInstruments}
        selectedPaymentInstruments={selectedPaymentInstruments}
        onApply={handleApplyFilters}
      />
    </ScreenContainer>
  )
}
