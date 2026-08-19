import { startTransition, useCallback, memo, useMemo } from "react"
import { useRouter, type Href } from "expo-router"
import { Text, View, ScrollView } from "react-native"

import { useAnalyticsBase } from "../../hooks/use-analytics-base"
import { useAnalyticsCharts } from "../../hooks/use-analytics-charts"
import { useAnalyticsStatistics } from "../../hooks/use-analytics-statistics"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { StatisticsCards } from "../../components/analytics/StatisticsCards"
import type { PaymentMethodSelectionKey } from "../../utils/analytics/filters"
import { PieChartSection } from "../../components/analytics/PieChartSection"
import { PaymentMethodPieChart } from "../../components/analytics/PaymentMethodPieChart"
import { LineChartSection } from "../../components/analytics/LineChartSection"
import { PaymentInstrumentPieChart } from "../../components/analytics/PaymentInstrumentPieChart"
import type { PaymentInstrumentSelectionKey } from "../../utils/analytics/filters"
import type { PaymentMethodType } from "../../types/expense"
import { formatMonthLabel } from "../../utils/analytics/time"
import {
  formatListBreakdown,
  paymentMethodLabel,
  formatSelectedPaymentInstrumentLabel,
  formatSelectedPaymentInstrumentsSummary,
  showPaymentInstrumentFilter as computeShowPaymentInstrumentFilter,
  prunePaymentInstrumentSelection,
} from "../../utils/analytics/filter-summary"
import { Filter, RefreshCw, Download } from "lucide-react-native"
import { useFilters, useFilterPersistence } from "../../stores/filter-store"
import { useTranslation } from "react-i18next"
import { logAsync } from "../../services/logger"
import { getCurrencySymbol } from "../../utils/currency"
import { useSyncAction } from "../../hooks/use-sync-action"
import { useSmsImportActions } from "../../hooks/use-sms-import-actions"
import { IconActionButton } from "../../components/ui/IconActionButton"
import { Button } from "../../components/ui/Button"
import { UI_OPACITY } from "../../constants/ui-tokens"
import { UI_SPACE } from "../../constants/ui-tokens"

// Memoized empty state component
const EmptyState = memo(function EmptyState({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <View className="items-center justify-center p-6">
      <Text
        className="text-center text-lg text-foreground"
        style={{ opacity: UI_OPACITY.subtle }}
      >
        {title}
      </Text>
      <Text
        className="text-center text-sm text-foreground mt-2"
        style={{ opacity: UI_OPACITY.ghost }}
      >
        {subtitle}
      </Text>
    </View>
  )
})

// Memoized header component
const Header = memo(function Header() {
  const { t } = useTranslation()
  const { handleSync, isSyncing } = useSyncAction()
  const { isScanningSmsImports, startSmsImportFromAdd } = useSmsImportActions()

  const handleImportPress = useCallback(() => {
    void startSmsImportFromAdd()
  }, [startSmsImportFromAdd])

  return (
    <View className="mb-4 flex-row items-center justify-between">
      <Text className="text-foreground opacity-60">{t("analytics.subtitle")}</Text>
      <View className="flex-row items-center gap-2 px-1">
        <IconActionButton
          icon={<RefreshCw size={20} />}
          onPress={handleSync}
          tooltip={t("settings.autoSync.syncNow")}
          disabled={isSyncing}
          spinning={isSyncing}
          accessibilityLabel={t("settings.autoSync.syncNow")}
          tooltipAlign="right"
        />
        <IconActionButton
          icon={<Download size={20} />}
          onPress={handleImportPress}
          tooltip={t("settings.smsImport.actions.review")}
          disabled={isScanningSmsImports}
          accessibilityLabel={t("settings.smsImport.actions.review")}
          tooltipAlign="right"
        />
      </View>
    </View>
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
    setSelectedCategories,
    setSelectedPaymentMethods,
    setSelectedPaymentInstruments,
    setSelectedCurrency,
  } = useFilters()
  // Initialize filter persistence (loads persisted filters from storage on mount)
  const { save: saveFilters } = useFilterPersistence()

  const router = useRouter()

  const openFilters = useCallback(() => {
    router.push("/filters" as Href)
  }, [router])

  // Destructure filter values for convenience
  const {
    timeWindow,
    selectedCategories,
    selectedPaymentMethods,
    selectedPaymentInstruments,
    searchQuery,
    minAmount,
    maxAmount,
  } = filters

  // Get analytics data from focused hooks
  const {
    filteredExpenses,
    availableCurrencies,
    effectiveCurrency,
    dateRange,
    isLoading,
    paymentInstruments,
    effectiveSelectedMonth,
    fullPeriodExpenses,
  } = useAnalyticsBase(
    timeWindow,
    selectedCategories,
    selectedPaymentMethods,
    selectedPaymentInstruments,
    searchQuery,
    minAmount,
    maxAmount
  )

  const {
    pieChartData,
    paymentMethodChartData,
    paymentInstrumentChartData,
    lineChartData,
  } = useAnalyticsCharts(filteredExpenses, dateRange, paymentInstruments, t)

  const { statistics } = useAnalyticsStatistics(
    filteredExpenses,
    effectiveSelectedMonth ? "all" : timeWindow,
    dateRange,
    fullPeriodExpenses
  )

  // Handle category selection from pie chart segment tap - memoized
  const handleCategorySelect = useCallback(
    (category: string | null) => {
      logAsync("INFO", "UI_ACTION", "ANALYTICS_CATEGORY_SELECT")
      if (category) {
        const newCategories = selectedCategories.includes(category)
          ? selectedCategories.filter((c) => c !== category)
          : [...selectedCategories, category]
        startTransition(() => setSelectedCategories(newCategories))
      }
    },
    [selectedCategories, setSelectedCategories]
  )

  const handlePaymentInstrumentSelect = useCallback(
    (key: PaymentInstrumentSelectionKey | null) => {
      logAsync("INFO", "UI_ACTION", "ANALYTICS_INSTRUMENT_SELECT")
      if (!key) {
        startTransition(() => setSelectedPaymentInstruments([]))
        return
      }

      const newInstruments =
        selectedPaymentInstruments.length === 1 && selectedPaymentInstruments[0] === key
          ? []
          : [key]
      startTransition(() => setSelectedPaymentInstruments(newInstruments))
    },
    [selectedPaymentInstruments, setSelectedPaymentInstruments]
  )

  const currencyButtons = useMemo(() => {
    return availableCurrencies.map((c) => ({
      code: c,
      isSelected: effectiveCurrency === c,
      onPress: () => {
        logAsync("INFO", "UI_ACTION", "ANALYTICS_CURRENCY_FILTER")
        startTransition(() => setSelectedCurrency(c))
        void saveFilters().catch((error) =>
          console.warn("Failed to persist currency selection:", error)
        )
      },
    }))
  }, [availableCurrencies, effectiveCurrency, setSelectedCurrency, saveFilters])

  const selectedPaymentMethodForChart: PaymentMethodType | null =
    selectedPaymentMethods.length === 1 && selectedPaymentMethods[0] !== "__none__"
      ? (selectedPaymentMethods[0] as PaymentMethodType)
      : null

  const handlePaymentMethodsChange = useCallback(
    (next: PaymentMethodSelectionKey[]) => {
      startTransition(() => {
        setSelectedPaymentMethods(next)
        // When payment methods are reset to "All", reset instruments to "All" too.
        if (next.length === 0) {
          setSelectedPaymentInstruments([])
        } else {
          const newInstruments = prunePaymentInstrumentSelection(
            next,
            selectedPaymentInstruments,
            paymentInstruments
          )
          setSelectedPaymentInstruments(newInstruments)
        }
      })
    },
    [
      paymentInstruments,
      selectedPaymentInstruments,
      setSelectedPaymentMethods,
      setSelectedPaymentInstruments,
    ]
  )

  const handlePaymentMethodSelect = useCallback(
    (paymentMethodType: PaymentMethodType | null) => {
      logAsync("INFO", "UI_ACTION", "ANALYTICS_PAYMENT_METHOD_SELECT")
      handlePaymentMethodsChange(paymentMethodType ? [paymentMethodType] : [])
    },
    [handlePaymentMethodsChange]
  )

  const showPaymentInstrumentFilter = useMemo(
    () => computeShowPaymentInstrumentFilter(paymentInstruments, selectedPaymentMethods),
    [paymentInstruments, selectedPaymentMethods]
  )

  // Check if there's any data to display
  const hasData = filteredExpenses.length > 0
  const hasAnyExpenses = pieChartData.length > 0 || lineChartData.some((d) => d.value > 0)

  // Helper to format category labels (translate "Other" category)
  const formatCategoryLabel = useCallback(
    (category: string): string => {
      return category === "Other" ? t("settings.categories.other") : category
    },
    [t]
  )

  const appliedChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = []

    if (effectiveSelectedMonth) {
      chips.push({
        key: "month",
        label: t("analytics.filters.month", {
          month: formatMonthLabel(effectiveSelectedMonth),
        }),
      })
    } else {
      chips.push({
        key: "time",
        label: t("analytics.filters.time", {
          window: t(`analytics.timeWindow.${timeWindow}`),
        }),
      })
    }

    // Show the applied currency chip only when more than one currency exists,
    // matching the History tab and the filter screen.
    if (availableCurrencies.length > 1) {
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
        label: t("analytics.filters.category", {
          category: formatCategoryLabel(selectedCategories[0]),
        }),
      })
    } else {
      chips.push({
        key: "category",
        label: t("analytics.filters.category", {
          category: `${selectedCategories.length} (${formatListBreakdown(selectedCategories.map(formatCategoryLabel), t("analytics.timeWindow.all"))})`,
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
        label: t("analytics.filters.payment", { method: paymentMethodLabel(only, t) }),
      })
    } else {
      chips.push({
        key: "payment-method",
        label: t("analytics.filters.payment", {
          method: `${selectedPaymentMethods.length} (${formatListBreakdown(
            selectedPaymentMethods.map((m) => paymentMethodLabel(m, t)),
            t("analytics.timeWindow.all")
          )})`,
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
              paymentInstruments,
              t
            ),
          }),
        })
      } else {
        chips.push({
          key: "payment-instrument",
          label: t("analytics.filters.instrument", {
            instrument: formatSelectedPaymentInstrumentsSummary(
              selectedPaymentInstruments,
              t
            ),
          }),
        })
      }
    }

    return chips
  }, [
    t,
    timeWindow,
    effectiveSelectedMonth,
    selectedCategories,
    selectedPaymentMethods,
    showPaymentInstrumentFilter,
    formatCategoryLabel,
    selectedPaymentInstruments,
    paymentInstruments,
    availableCurrencies,
    effectiveCurrency,
  ])

  return (
    <ScreenContainer>
      <Header />

      <View
        className="mb-4 flex-row items-center justify-between gap-2"
        style={{ overflow: "visible" }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: UI_SPACE.control }}
          className="flex-1"
        >
          {appliedChips.map((chip) => (
            <Button
              key={chip.key}
              size="chip"
              variant="outline"
              disabled={!filtersHydrated}
              onPress={openFilters}
            >
              <Text numberOfLines={1}>{chip.label}</Text>
            </Button>
          ))}
        </ScrollView>

        <Button
          size="chip"
          className="gap-2"
          disabled={!filtersHydrated}
          onPress={openFilters}
          variant={activeCount > 0 ? "accent" : undefined}
        >
          <Filter size={16} />
          {!filtersHydrated
            ? t("analytics.filters.button")
            : activeCount > 0
              ? `${t("analytics.filters.button")} (${activeCount})`
              : t("analytics.filters.button")}
        </Button>
      </View>

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
              <StatisticsCards
                statistics={statistics}
                currencyCode={effectiveCurrency}
                fullPeriodTotalSpending={statistics.fullPeriodTotalSpending}
                hasActiveFilters={activeCount > 0}
              />
              {/* Currency Filter - Show only if multiple currencies exist */}
              {availableCurrencies.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    gap: UI_SPACE.control,
                    paddingBottom: UI_SPACE.gutter,
                  }}
                  style={{ marginBottom: UI_SPACE.control }}
                >
                  {currencyButtons.map(({ code, isSelected, onPress }) => (
                    <Button
                      key={code}
                      size="chip"
                      variant={isSelected ? "accent" : "outline"}
                      onPress={onPress}
                    >
                      {code} ({getCurrencySymbol(code)})
                    </Button>
                  ))}
                </ScrollView>
              )}
              <View className="gap-4">
                <PieChartSection
                  data={pieChartData}
                  currencyCode={effectiveCurrency}
                  onCategorySelect={handleCategorySelect}
                />
                <PaymentMethodPieChart
                  data={paymentMethodChartData}
                  currencyCode={effectiveCurrency}
                  selectedPaymentMethod={selectedPaymentMethodForChart}
                  onPaymentMethodSelect={handlePaymentMethodSelect}
                />
                <PaymentInstrumentPieChart
                  data={paymentInstrumentChartData}
                  currencyCode={effectiveCurrency}
                  selectedKey={
                    selectedPaymentInstruments.length === 1
                      ? selectedPaymentInstruments[0]
                      : null
                  }
                  onSelect={handlePaymentInstrumentSelect}
                />
                <LineChartSection data={lineChartData} currencyCode={effectiveCurrency} />
              </View>
            </>
          )}
        </>
      )}
    </ScreenContainer>
  )
}
