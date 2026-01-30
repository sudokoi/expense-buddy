import { useState, useCallback, memo, useMemo } from "react"
import { YStack, H4, XStack, Text, Button, ScrollView } from "tamagui"
import { ViewStyle, TextStyle } from "react-native"
import { TimeWindow } from "../../utils/analytics-calculations"
import {
  useAnalyticsBase,
  useAnalyticsCharts,
  useAnalyticsStatistics,
} from "../../hooks/use-analytics-data"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { StatisticsCards } from "../../components/analytics/StatisticsCards"
import type { PaymentMethodSelectionKey } from "../../utils/analytics-calculations"
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
import { getPaymentMethodI18nKey } from "../../constants/payment-methods"
import { useFilters, useFilterPersistence } from "../../stores/filter-store"
import { useTranslation } from "react-i18next"
import { getCurrencySymbol } from "../../utils/currency"

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

const INSTRUMENT_OTHERS_ID = "__others__"

// Moved helper functions outside component or use hooks/t inside
// To use translations in helpers, we need to pass t or return keys?
// Easier to refactor helpers to component scope or pass t.

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
  const { t } = useTranslation()
  return (
    <XStack style={styles.headerRow}>
      <YStack>
        <H4>{t("analytics.title")}</H4>
        <Text color="$color" opacity={0.6}>
          {t("analytics.subtitle")}
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
  const { t } = useTranslation()

  // Use shared filter store
  const {
    filters,
    activeCount,
    isHydrated: filtersHydrated,
    applyFilters,
    setSelectedCategories,
    setSelectedPaymentMethods,
    setSelectedPaymentInstruments,
    setSelectedCurrency,
  } = useFilters()

  // Initialize filter persistence (loads from storage on mount, provides save function)
  const { save } = useFilterPersistence()

  // Filters sheet open state
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Destructure filter values for convenience
  const {
    timeWindow,
    selectedCategories,
    selectedPaymentMethods,
    selectedPaymentInstruments,
    selectedCurrency,
  } = filters

  // Get analytics data from focused hooks
  const {
    filteredExpenses,
    availableCurrencies,
    effectiveCurrency,
    dateRange,
    isLoading,
    paymentInstruments,
  } = useAnalyticsBase(
    timeWindow,
    selectedCategories,
    selectedPaymentMethods,
    selectedPaymentInstruments,
    selectedCurrency
  )

  const {
    pieChartData,
    paymentMethodChartData,
    paymentInstrumentChartData,
    lineChartData,
  } = useAnalyticsCharts(filteredExpenses, dateRange, paymentInstruments, t)

  const { statistics } = useAnalyticsStatistics(filteredExpenses, timeWindow, dateRange)

  // Handle category selection from pie chart segment tap - memoized
  const handleCategorySelect = useCallback(
    (category: string | null) => {
      if (category) {
        const newCategories = selectedCategories.includes(category)
          ? selectedCategories.filter((c) => c !== category)
          : [...selectedCategories, category]
        setSelectedCategories(newCategories)
      }
    },
    [selectedCategories, setSelectedCategories]
  )

  const handlePaymentInstrumentSelect = useCallback(
    (key: PaymentInstrumentSelectionKey | null) => {
      if (!key) {
        setSelectedPaymentInstruments([])
        return
      }

      const newInstruments =
        selectedPaymentInstruments.length === 1 && selectedPaymentInstruments[0] === key
          ? []
          : [key]
      setSelectedPaymentInstruments(newInstruments)
    },
    [selectedPaymentInstruments, setSelectedPaymentInstruments]
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
      // When payment methods are reset to "All", reset instruments to "All" too.
      if (next.length === 0) {
        setSelectedPaymentInstruments([])
      } else {
        const newInstruments = prunePaymentInstrumentSelection(
          next,
          selectedPaymentInstruments
        )
        setSelectedPaymentInstruments(newInstruments)
      }
    },
    [
      prunePaymentInstrumentSelection,
      selectedPaymentInstruments,
      setSelectedPaymentMethods,
      setSelectedPaymentInstruments,
    ]
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

  // Helpers inside component to use translation hook
  const formatSelectedPaymentInstrumentLabel = useCallback(
    (key: PaymentInstrumentSelectionKey, instruments: PaymentInstrument[]): string => {
      const [method, instrumentId] = key.split("::")
      const shortMethod = methodShortLabel(method)

      if (!instrumentId || instrumentId === INSTRUMENT_OTHERS_ID) {
        return `${shortMethod} • ${t("analytics.chart.others")}`
      }

      const inst = findInstrumentById(instruments, instrumentId)
      if (!inst || inst.deletedAt) {
        return `${shortMethod} • ${t("analytics.chart.others")}`
      }

      return `${shortMethod} • ${formatPaymentInstrumentLabel(inst)}`
    },
    [t]
  )

  const formatSelectedPaymentInstrumentsSummary = useCallback(
    (keys: PaymentInstrumentSelectionKey[]): string => {
      if (keys.length === 0) return t("analytics.timeWindow.all")
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
    },
    [t]
  )

  const formatListBreakdown = useCallback(
    (items: string[]): string => {
      const MAX_ITEMS = 3

      const unique = Array.from(new Set(items)).sort((a, b) => a.localeCompare(b))
      const visible = unique.slice(0, MAX_ITEMS)
      const remaining = unique.length - visible.length

      if (unique.length === 0) return t("analytics.timeWindow.all")
      if (unique.length === 1) return unique[0]

      return remaining > 0 ? `${visible.join(", ")}, +${remaining}` : visible.join(", ")
    },
    [t]
  )

  const paymentMethodLabel = useCallback(
    (key: PaymentMethodSelectionKey): string => {
      if (key === "__none__") return t("analytics.chart.none")
      // Use helper to get the i18n key instead of the hardcoded label
      return t(`paymentMethods.${getPaymentMethodI18nKey(key as PaymentMethodType)}`)
    },
    [t]
  )

  const appliedChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = []

    chips.push({
      key: "time",
      label: t("analytics.filters.time", {
        window: t(`analytics.timeWindow.${timeWindow}`),
      }),
    })

    // Show Currency Chip if multiple available or purely informational if simplistic
    // User requested: "show applied currency in the applied filters"
    if (availableCurrencies.length > 0) {
      chips.push({
        key: "currency",
        label: `${t("settings.localization.currency")}: ${effectiveCurrency} (${getCurrencySymbol(effectiveCurrency)})`,
      })
    }

    if (selectedCategories.length === 0) {
      chips.push({
        key: "category",
        label: t("analytics.filters.category", {
          category: t("analytics.timeWindow.all"),
        }),
      })
    } else if (selectedCategories.length === 1) {
      chips.push({
        key: "category",
        label: t("analytics.filters.category", { category: selectedCategories[0] }),
      })
    } else {
      chips.push({
        key: "category",
        label: t("analytics.filters.category", {
          category: `${selectedCategories.length} (${formatListBreakdown(selectedCategories)})`,
        }),
      })
    }

    if (selectedPaymentMethods.length === 0) {
      chips.push({
        key: "payment-method",
        label: t("analytics.filters.payment", { method: t("analytics.timeWindow.all") }),
      })
    } else if (selectedPaymentMethods.length === 1) {
      const only = selectedPaymentMethods[0]
      chips.push({
        key: "payment-method",
        label: t("analytics.filters.payment", { method: paymentMethodLabel(only) }),
      })
    } else {
      chips.push({
        key: "payment-method",
        label: t("analytics.filters.payment", {
          method: `${selectedPaymentMethods.length} (${formatListBreakdown(selectedPaymentMethods.map(paymentMethodLabel))})`,
        }),
      })
    }

    if (showPaymentInstrumentFilter) {
      if (selectedPaymentInstruments.length === 0) {
        chips.push({
          key: "payment-instrument",
          label: t("analytics.filters.instrument", {
            instrument: t("analytics.timeWindow.all"),
          }),
        })
      } else if (selectedPaymentInstruments.length === 1) {
        chips.push({
          key: "payment-instrument",
          label: t("analytics.filters.instrument", {
            instrument: formatSelectedPaymentInstrumentLabel(
              selectedPaymentInstruments[0],
              paymentInstruments
            ),
          }),
        })
      } else {
        chips.push({
          key: "payment-instrument",
          label: t("analytics.filters.instrument", {
            instrument: formatSelectedPaymentInstrumentsSummary(
              selectedPaymentInstruments
            ),
          }),
        })
      }
    }

    return chips
  }, [
    t,
    timeWindow,
    selectedCategories,
    selectedPaymentMethods,
    showPaymentInstrumentFilter,
    formatListBreakdown,
    paymentMethodLabel,
    selectedPaymentInstruments,
    formatSelectedPaymentInstrumentLabel,
    paymentInstruments,
    formatSelectedPaymentInstrumentsSummary,
    availableCurrencies,
    effectiveCurrency,
  ])

  const handleApplyFilters = useCallback(
    (next: {
      timeWindow: TimeWindow
      selectedCategories: string[]
      selectedPaymentMethods: PaymentMethodSelectionKey[]
      selectedPaymentInstruments: PaymentInstrumentSelectionKey[]
      selectedCurrency: string | null
    }) => {
      // When payment methods are reset to "All", ensure instruments reset too.
      const normalizedPaymentInstruments =
        next.selectedPaymentMethods.length === 0 ? [] : next.selectedPaymentInstruments

      // Apply all filters at once to the store
      applyFilters({
        timeWindow: next.timeWindow,
        selectedCategories: next.selectedCategories,
        selectedPaymentMethods: next.selectedPaymentMethods,
        selectedPaymentInstruments: normalizedPaymentInstruments,
        selectedCurrency: next.selectedCurrency,
        searchQuery: filters.searchQuery,
        minAmount: filters.minAmount,
        maxAmount: filters.maxAmount,
      })

      // Persist to storage
      void save().catch((error) =>
        console.warn("Failed to persist analytics filters:", error)
      )

      setFiltersOpen(false)
    },
    [applyFilters, save, filters.searchQuery, filters.minAmount, filters.maxAmount]
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
              disabled={!filtersHydrated}
              onPress={() => setFiltersOpen(true)}
              style={{ borderRadius: 999 }}
            >
              <Button.Text numberOfLines={1}>{chip.label}</Button.Text>
            </Button>
          ))}
        </ScrollView>

        <Button
          size="$3"
          disabled={!filtersHydrated}
          onPress={() => setFiltersOpen(true)}
          icon={SlidersHorizontal}
          bordered
        >
          {!filtersHydrated
            ? t("analytics.filters.button")
            : activeCount > 0
              ? `${t("analytics.filters.button")} (${activeCount})`
              : t("analytics.filters.button")}
        </Button>
      </XStack>

      {isLoading ? (
        <EmptyState title={t("analytics.empty.loading")} subtitle="" />
      ) : (
        <>
          {!hasAnyExpenses ? (
            <EmptyState
              title={t("analytics.empty.noData")}
              subtitle={t("analytics.empty.noDataSubtitle")}
            />
          ) : !hasData && selectedCategories.length > 0 ? (
            <EmptyState
              title={t("analytics.empty.noMatch")}
              subtitle={t("analytics.empty.noMatchSubtitle")}
            />
          ) : (
            <>
              <StatisticsCards statistics={statistics} currencyCode={effectiveCurrency} />
              {/* Currency Filter - Show only if multiple currencies exist */}
              {availableCurrencies.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 16 } as any}
                  style={{ marginBottom: 4 }}
                >
                  {availableCurrencies.map((c) => (
                    <Button
                      key={c}
                      size="$2"
                      onPress={() => setSelectedCurrency(c)}
                      themeInverse={effectiveCurrency === c}
                      bordered={effectiveCurrency !== c}
                      style={{ borderRadius: 999 }}
                    >
                      {c} ({getCurrencySymbol(c)})
                    </Button>
                  ))}
                </ScrollView>
              )}
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
              <LineChartSection data={lineChartData} currencyCode={effectiveCurrency} />
            </>
          )}
        </>
      )}

      <AnalyticsFiltersSheet
        open={filtersOpen}
        isHydrating={!filtersHydrated}
        timeWindow={timeWindow}
        selectedCategories={selectedCategories}
        selectedPaymentMethods={selectedPaymentMethods}
        paymentInstruments={paymentInstruments}
        selectedPaymentInstruments={selectedPaymentInstruments}
        availableCurrencies={availableCurrencies}
        selectedCurrency={selectedCurrency}
        effectiveCurrency={effectiveCurrency}
        onApply={handleApplyFilters}
      />
    </ScreenContainer>
  )
}
