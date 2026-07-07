/**
 * Filters Screen
 *
 * A full-screen filter editor shared by the History and Analytics tabs.
 * Replaces the previous per-tab filter sheets (history FilterSheet and
 * AnalyticsFiltersSheet) with a single route-based screen, opened the same way
 * as the edit-expense screen. Uses local draft state and commits to the shared
 * filter store only when "Apply" is pressed.
 */

import React, { useCallback, useMemo, useState } from "react"
import { Stack, useRouter } from "expo-router"
import { YStack, XStack, Button, Text } from "tamagui"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ScreenContainer } from "../components/ui/ScreenContainer"
import { TimeWindowSelector } from "../components/analytics/TimeWindowSelector"
import { MonthSelector } from "../components/analytics/MonthSelector"
import { SearchFilter } from "../components/analytics/SearchFilter"
import { AmountRangeFilter } from "../components/analytics/AmountRangeFilter"
import { CategoryFilter } from "../components/analytics/CategoryFilter"
import { PaymentMethodFilter } from "../components/analytics/PaymentMethodFilter"
import { PaymentInstrumentFilter } from "../components/analytics/PaymentInstrumentFilter"
import { CurrencyFilter } from "../components/analytics/CurrencyFilter"

import { useFilters, useFilterPersistence } from "../stores/filter-store"
import { useSettings, useDerivedExpenseData } from "../stores/hooks"
import {
  getActivePaymentInstruments,
  PAYMENT_INSTRUMENT_METHODS,
} from "../services/payment-instruments"
import { logAsync } from "../services/logger"
import type {
  TimeWindow,
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
} from "../types/analytics"
import type { PaymentInstrument } from "../types/payment-instrument"
import { UI_SPACE, UI_OPACITY, UI_FONT_WEIGHT } from "../constants/ui-tokens"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []

export default function FiltersScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { filters, isHydrated, applyFilters } = useFilters()
  const { save: saveFilters } = useFilterPersistence()
  const { settings } = useSettings()
  const {
    availableMonths,
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
  const [draftMinAmount, setDraftMinAmount] = useState<number | null>(filters.minAmount)
  const [draftMaxAmount, setDraftMaxAmount] = useState<number | null>(filters.maxAmount)
  const [draftCurrency, setDraftCurrency] = useState<string | null>(
    filters.selectedCurrency
  )

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
  const showPaymentInstrumentFilter = useMemo(() => {
    const active = getActivePaymentInstruments(allInstruments)
    const allowedMethods =
      draftPaymentMethods.length === 0
        ? new Set(PAYMENT_INSTRUMENT_METHODS)
        : new Set(
            PAYMENT_INSTRUMENT_METHODS.filter((m) =>
              draftPaymentMethods.includes(m as PaymentMethodSelectionKey)
            )
          )

    for (const method of PAYMENT_INSTRUMENT_METHODS) {
      if (!allowedMethods.has(method)) continue
      if (active.some((i) => i.method === method)) return true
    }
    return false
  }, [allInstruments, draftPaymentMethods])

  // Drop instrument selections that are no longer valid for the chosen methods.
  const prunePaymentInstrumentSelection = useCallback(
    (
      nextSelectedPaymentMethods: PaymentMethodSelectionKey[],
      currentInstrumentSelection: PaymentInstrumentSelectionKey[]
    ): PaymentInstrumentSelectionKey[] => {
      if (currentInstrumentSelection.length === 0) return currentInstrumentSelection

      const active = getActivePaymentInstruments(allInstruments)
      const allowedMethods: Set<string> =
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
    [allInstruments]
  )

  const handlePaymentMethodsChange = useCallback(
    (next: PaymentMethodSelectionKey[]) => {
      setDraftPaymentMethods(next)
      setDraftPaymentInstruments((prev) => {
        if (next.length === 0) return []
        return prunePaymentInstrumentSelection(next, prev)
      })
    },
    [prunePaymentInstrumentSelection]
  )

  const handleAmountRangeChange = useCallback(
    (min: number | null, max: number | null) => {
      setDraftMinAmount(min)
      setDraftMaxAmount(max)
    },
    []
  )

  const handleResetDraft = useCallback(() => {
    setDraftTimeWindow("all")
    setDraftSelectedMonth(null)
    setDraftCategories([])
    setDraftPaymentMethods([])
    setDraftPaymentInstruments([])
    setDraftSearchQuery("")
    setDraftMinAmount(null)
    setDraftMaxAmount(null)
    setDraftCurrency(null) // Reset to auto
    logAsync("INFO", "UI_ACTION", "RESET_FILTER_DRAFT")
  }, [])

  const handleApply = useCallback(() => {
    applyFilters({
      timeWindow: draftTimeWindow,
      selectedMonth: draftSelectedMonth,
      selectedCategories: draftCategories,
      selectedPaymentMethods: draftPaymentMethods,
      selectedPaymentInstruments: draftPaymentInstruments,
      selectedCurrency: draftCurrency,
      searchQuery: draftSearchQuery,
      minAmount: draftMinAmount,
      maxAmount: draftMaxAmount,
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
    draftSelectedMonth,
    draftCategories,
    draftPaymentMethods,
    draftPaymentInstruments,
    draftSearchQuery,
    draftMinAmount,
    draftMaxAmount,
  ])

  return (
    <>
      <Stack.Screen
        options={{
          title: t("history.filterSheet.title"),
          headerRight: () => (
            <Button size="$compact" chromeless onPress={handleResetDraft}>
              {t("common.reset")}
            </Button>
          ),
        }}
      />

      <ScreenContainer contentContainerStyle={{ paddingBottom: 0 }}>
        <YStack gap="$section">
          {!isHydrated && (
            <Text color="$color" opacity={UI_OPACITY.subtle} fontSize="$body">
              {t("history.filterSheet.loading")}
            </Text>
          )}

          <YStack gap="$control">
            <Text fontWeight={UI_FONT_WEIGHT.semiBold} fontSize="$label" color="$color">
              {t("history.filterSheet.time")}
            </Text>
            <TimeWindowSelector
              value={draftTimeWindow}
              onChange={handleTimeWindowChange}
            />
          </YStack>

          <YStack gap="$control">
            <Text fontWeight={UI_FONT_WEIGHT.semiBold} fontSize="$label" color="$color">
              {t("history.filterSheet.month")}
            </Text>
            <MonthSelector
              value={draftSelectedMonth}
              availableMonths={availableMonths}
              onChange={handleMonthChange}
            />
          </YStack>

          {availableCurrencies.length > 1 && (
            <YStack gap="$control">
              <Text fontWeight={UI_FONT_WEIGHT.semiBold} fontSize="$label" color="$color">
                {t("settings.localization.currency")}
              </Text>
              <CurrencyFilter
                availableCurrencies={availableCurrencies}
                selectedCurrency={draftCurrency}
                defaultCurrency={defaultCurrency}
                onChange={setDraftCurrency}
              />
            </YStack>
          )}

          <YStack gap="$control">
            <Text fontWeight={UI_FONT_WEIGHT.semiBold} fontSize="$label" color="$color">
              {t("history.filterSheet.search")}
            </Text>
            <SearchFilter value={draftSearchQuery} onChange={setDraftSearchQuery} />
          </YStack>

          <YStack gap="$control">
            <Text fontWeight={UI_FONT_WEIGHT.semiBold} fontSize="$label" color="$color">
              {t("history.filterSheet.amountRange")}
            </Text>
            <AmountRangeFilter
              minAmount={draftMinAmount}
              maxAmount={draftMaxAmount}
              onChange={handleAmountRangeChange}
            />
          </YStack>

          <YStack gap="$control">
            <Text fontWeight={UI_FONT_WEIGHT.semiBold} fontSize="$label" color="$color">
              {t("history.filterSheet.category")}
            </Text>
            <CategoryFilter
              selectedCategories={draftCategories}
              onChange={setDraftCategories}
            />
          </YStack>

          <YStack gap="$control">
            <Text fontWeight={UI_FONT_WEIGHT.semiBold} fontSize="$label" color="$color">
              {t("history.filterSheet.paymentMethod")}
            </Text>
            <PaymentMethodFilter
              selected={draftPaymentMethods}
              onChange={handlePaymentMethodsChange}
            />
          </YStack>

          {showPaymentInstrumentFilter && (
            <YStack gap="$control">
              <Text fontWeight={UI_FONT_WEIGHT.semiBold} fontSize="$label" color="$color">
                {t("history.filterSheet.paymentInstrument")}
              </Text>
              <PaymentInstrumentFilter
                instruments={allInstruments}
                selectedPaymentMethods={draftPaymentMethods}
                selected={draftPaymentInstruments}
                onChange={setDraftPaymentInstruments}
              />
            </YStack>
          )}

          <XStack
            gap="$control"
            style={{
              justifyContent: "flex-end",
              paddingTop: UI_SPACE.control,
              paddingBottom: Math.max(insets.bottom, UI_SPACE.gutter),
            }}
          >
            <Button size="$control" onPress={() => router.back()}>
              {t("common.cancel")}
            </Button>
            <Button size="$control" theme="accent" onPress={handleApply}>
              {t("common.apply")}
            </Button>
          </XStack>
        </YStack>
      </ScreenContainer>
    </>
  )
}
