/**
 * Filters Screen
 *
 * A full-screen filter editor shared by the History and Analytics tabs.
 * Replaces the previous per-tab filter sheets (history FilterSheet and
 * AnalyticsFiltersSheet) with a single route-based screen, opened the same way
 * as the edit-expense screen. Uses local draft state and commits to the shared
 * filter store only when "Apply" is pressed.
 */

import { useCallback, useMemo, useState } from "react"
import { Stack, useRouter } from "expo-router"
import { Keyboard, Text, View } from "react-native"
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller"
import { isValid, parseISO, format } from "date-fns"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { parseAmountRange } from "../utils/analytics/amount-range"
import { TimeWindowSelector } from "../components/analytics/TimeWindowSelector"
import { MonthSelector } from "../components/analytics/MonthSelector"
import { SearchFilter } from "../components/analytics/SearchFilter"
import { AmountRangeFilter } from "../components/analytics/AmountRangeFilter"
import { CategoryFilter } from "../components/analytics/CategoryFilter"
import { PaymentMethodFilter } from "../components/analytics/PaymentMethodFilter"
import { PaymentInstrumentFilter } from "../components/analytics/PaymentInstrumentFilter"
import { CurrencyFilter } from "../components/analytics/CurrencyFilter"
import { Button } from "../components/ui/Button"

import { useFilters, useFilterPersistence } from "../stores/filter-store"
import { useSettings, useDerivedExpenseData } from "../stores/hooks"
import {
  prunePaymentInstrumentSelection,
  showPaymentInstrumentFilter as computeShowPaymentInstrumentFilter,
} from "../utils/analytics/filter-summary"
import { logAsync } from "../services/logger"
import { hapticLight } from "../utils/haptics"
import type {
  TimeWindow,
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
} from "../types/analytics"
import type { PaymentInstrument } from "../types/payment-instrument"
import { UI_SPACE } from "../constants/ui-tokens"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []

export default function FiltersScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { filters, isHydrated, applyFilters } = useFilters()
  const { save: saveFilters } = useFilterPersistence()
  const { settings } = useSettings()
  const {
    expensesByCurrency,
    availableCurrencies,
    defaultCurrency,
    effectiveSelectedMonth,
  } = useDerivedExpenseData()

  const allInstruments = settings.paymentInstruments ?? EMPTY_INSTRUMENTS

  // Local draft state, seeded from the resolved (effective) values.
  // effectiveSelectedMonth is used instead of filters.selectedMonth because
  // the stored month may be stale (not available for the current currency).
  const [draftTimeWindow, setDraftTimeWindow] = useState<TimeWindow>(filters.timeWindow)
  const [draftSelectedMonth, setDraftSelectedMonth] = useState<string | null>(
    effectiveSelectedMonth
  )
  const [draftCategories, setDraftCategories] = useState<string[]>(
    filters.selectedCategories
  )
  const [draftPaymentMethods, setDraftPaymentMethods] = useState<
    PaymentMethodSelectionKey[]
  >(filters.selectedPaymentMethods)
  const [draftPaymentInstruments, setDraftPaymentInstruments] = useState<
    PaymentInstrumentSelectionKey[]
  >(filters.selectedPaymentInstruments)
  const [draftSearchQuery, setDraftSearchQuery] = useState(filters.searchQuery)
  const [draftMin, setDraftMin] = useState(filters.minAmount?.toString() ?? "")
  const [draftMax, setDraftMax] = useState(filters.maxAmount?.toString() ?? "")
  const [draftCurrency, setDraftCurrency] = useState<string | null>(
    filters.selectedCurrency
  )
  const range = parseAmountRange(draftMin, draftMax, settings.enableMathExpressions)
  const draftEffectiveCurrency = draftCurrency ?? defaultCurrency
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    for (const expense of expensesByCurrency.get(draftEffectiveCurrency) ?? []) {
      const date = parseISO(expense.date)
      if (isValid(date)) months.add(format(date, "yyyy-MM"))
    }
    return [...months].sort((a, b) => b.localeCompare(a))
  }, [expensesByCurrency, draftEffectiveCurrency])
  const selectedMonth =
    draftSelectedMonth && availableMonths.includes(draftSelectedMonth)
      ? draftSelectedMonth
      : null

  const handleTimeWindowChange = useCallback((window: TimeWindow) => {
    setDraftTimeWindow(window)
    setDraftSelectedMonth(null)
  }, [])

  const handleMonthChange = useCallback((month: string | null) => {
    setDraftSelectedMonth(month)
    if (month) {
      setDraftTimeWindow("all")
    }
  }, [])

  // Whether the payment instrument filter should be shown for the current draft.
  const showPaymentInstrumentFilter = useMemo(
    () => computeShowPaymentInstrumentFilter(allInstruments, draftPaymentMethods),
    [allInstruments, draftPaymentMethods]
  )

  const handlePaymentMethodsChange = useCallback(
    (next: PaymentMethodSelectionKey[]) => {
      setDraftPaymentMethods(next)
      setDraftPaymentInstruments((prev) => {
        if (next.length === 0) return []
        return prunePaymentInstrumentSelection(next, prev, allInstruments)
      })
    },
    [allInstruments]
  )

  const handleResetDraft = useCallback(() => {
    setDraftTimeWindow("all")
    setDraftSelectedMonth(null)
    setDraftCategories([])
    setDraftPaymentMethods([])
    setDraftPaymentInstruments([])
    setDraftSearchQuery("")
    setDraftMin("")
    setDraftMax("")
    setDraftCurrency(null) // Reset to auto
    void hapticLight()
    logAsync("INFO", "UI_ACTION", "RESET_FILTER_DRAFT")
  }, [])

  const handleApply = useCallback(() => {
    if (!isHydrated || range.error) return
    Keyboard.dismiss()
    void hapticLight()
    applyFilters({
      timeWindow: draftTimeWindow,
      selectedMonth,
      selectedCategories: draftCategories,
      selectedPaymentMethods: draftPaymentMethods,
      selectedPaymentInstruments: draftPaymentInstruments,
      selectedCurrency: draftCurrency,
      searchQuery: draftSearchQuery,
      minAmount: range.minAmount,
      maxAmount: range.maxAmount,
    })
    void saveFilters().catch((error) => console.warn("Failed to persist filters:", error))
    logAsync("INFO", "UI_ACTION", "APPLY_FILTERS")
    router.back()
  }, [
    applyFilters,
    saveFilters,
    router,
    draftCurrency,
    draftTimeWindow,
    selectedMonth,
    draftCategories,
    draftPaymentMethods,
    draftPaymentInstruments,
    draftSearchQuery,
    range.minAmount,
    range.maxAmount,
    range.error,
    isHydrated,
  ])

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t("history.filterSheet.title"),
          headerRight: () => (
            <Button
              size="compact"
              variant="ghost"
              onPress={handleResetDraft}
              accessibilityLabel={t("common.reset")}
            >
              {t("common.reset")}
            </Button>
          ),
        }}
      />

      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        bottomOffset={100}
        contentContainerStyle={{ padding: UI_SPACE.gutter, paddingBottom: 120 }}
      >
        <View className="w-full max-w-[600px] self-center gap-6">
          {!isHydrated && (
            <Text className="text-[13px] text-foreground opacity-60">
              {t("history.filterSheet.loading")}
            </Text>
          )}

          <Text className="text-sm text-muted-foreground">
            {t("analytics.filters.sharedHelp")}
          </Text>

          <View className="gap-2">
            <Text className="font-semibold text-sm text-foreground">
              {t("history.filterSheet.search")}
            </Text>
            <SearchFilter value={draftSearchQuery} onChange={setDraftSearchQuery} />
          </View>

          <View className="gap-2">
            <Text className="font-semibold text-sm text-foreground">
              {t("history.filterSheet.time")}
            </Text>
            <TimeWindowSelector
              value={selectedMonth ? null : draftTimeWindow}
              onChange={handleTimeWindowChange}
            />
          </View>

          <View className="gap-2">
            <Text className="font-semibold text-sm text-foreground">
              {t("history.filterSheet.month")}
            </Text>
            <MonthSelector
              value={selectedMonth}
              availableMonths={availableMonths}
              onChange={handleMonthChange}
            />
          </View>

          {availableCurrencies.length > 1 && (
            <View className="gap-2">
              <Text className="font-semibold text-sm text-foreground">
                {t("settings.localization.currency")}
              </Text>
              <CurrencyFilter
                availableCurrencies={availableCurrencies}
                selectedCurrency={draftCurrency}
                defaultCurrency={defaultCurrency}
                onChange={setDraftCurrency}
              />
            </View>
          )}

          <View className="gap-2">
            <Text className="font-semibold text-sm text-foreground">
              {t("history.filterSheet.amountRange")}
            </Text>
            <AmountRangeFilter
              min={draftMin}
              max={draftMax}
              onMinChange={setDraftMin}
              onMaxChange={setDraftMax}
              currencyCode={draftEffectiveCurrency}
              allowMathExpressions={settings.enableMathExpressions}
              error={range.error ? t(`analytics.filters.${range.error}`) : undefined}
            />
          </View>

          <View className="gap-2">
            <Text className="font-semibold text-sm text-foreground">
              {t("history.filterSheet.category")}
            </Text>
            <CategoryFilter
              selectedCategories={draftCategories}
              onChange={setDraftCategories}
            />
          </View>

          <View className="gap-2">
            <Text className="font-semibold text-sm text-foreground">
              {t("history.filterSheet.paymentMethod")}
            </Text>
            <PaymentMethodFilter
              selected={draftPaymentMethods}
              onChange={handlePaymentMethodsChange}
            />
          </View>

          {showPaymentInstrumentFilter && (
            <View className="gap-2">
              <Text className="font-semibold text-sm text-foreground">
                {t("history.filterSheet.paymentInstrument")}
              </Text>
              <PaymentInstrumentFilter
                instruments={allInstruments}
                selectedPaymentMethods={draftPaymentMethods}
                selected={draftPaymentInstruments}
                onChange={setDraftPaymentInstruments}
              />
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>
      <KeyboardStickyView>
        <View
          className="flex-row gap-2 border-t border-border bg-background px-5"
          style={{
            justifyContent: "flex-end",
            paddingTop: UI_SPACE.control,
            paddingBottom: Math.max(insets.bottom, UI_SPACE.gutter),
          }}
        >
          <Button
            size="control"
            className="flex-1"
            onPress={() => router.back()}
            accessibilityLabel={t("common.cancel")}
          >
            {t("common.cancel")}
          </Button>
          <Button
            size="control"
            variant="accent"
            className="flex-1"
            disabled={!isHydrated || !!range.error}
            onPress={handleApply}
            accessibilityLabel={t("common.apply")}
          >
            {t("analytics.filters.apply")}
          </Button>
        </View>
      </KeyboardStickyView>
    </View>
  )
}
