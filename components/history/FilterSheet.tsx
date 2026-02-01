/**
 * FilterSheet Component
 *
 * A sheet component for filtering expenses in the history screen.
 * Extracted from history.tsx to reduce component size and improve maintainability.
 */

import React, { useState, useCallback, useMemo } from "react"
import { YStack, XStack, H4, Button, Text, Sheet, ScrollView } from "tamagui"
import { X } from "@tamagui/lucide-icons"
import { ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import type {
  TimeWindow,
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
} from "../../types/analytics"
import type { PaymentInstrument } from "../../types/payment-instrument"
import type { Category } from "../../types/category"
import { TimeWindowSelector } from "../analytics/TimeWindowSelector"
import { MonthSelector } from "../analytics/MonthSelector"
import { CategoryFilter } from "../analytics/CategoryFilter"
import { PaymentMethodFilter } from "../analytics/PaymentMethodFilter"
import { PaymentInstrumentFilter } from "../analytics/PaymentInstrumentFilter"
import { AmountRangeFilter } from "../analytics/AmountRangeFilter"
import { SearchFilter } from "../analytics/SearchFilter"
import { CollapsibleSection } from "../analytics/CollapsibleSection"
import {
  getActivePaymentInstruments,
  PAYMENT_INSTRUMENT_METHODS,
} from "../../services/payment-instruments"

interface FilterSheetProps {
  open: boolean
  onClose: () => void
  filters: {
    timeWindow: TimeWindow
    selectedMonth: string | null
    selectedCategories: string[]
    selectedPaymentMethods: PaymentMethodSelectionKey[]
    selectedPaymentInstruments: PaymentInstrumentSelectionKey[]
    searchQuery: string
    minAmount: number | null
    maxAmount: number | null
  }
  isHydrated: boolean
  allInstruments: PaymentInstrument[]
  categories: Category[]
  availableMonths: string[]
  onTimeWindowChange: (window: TimeWindow) => void
  onMonthChange: (month: string | null) => void
  onCategoriesChange: (categories: string[]) => void
  onPaymentMethodsChange: (methods: PaymentMethodSelectionKey[]) => void
  onPaymentInstrumentsChange: (instruments: PaymentInstrumentSelectionKey[]) => void
  onSearchChange: (query: string) => void
  onAmountRangeChange: (min: number | null, max: number | null) => void
  _onReset: () => void
}

const layoutStyles = {
  sheetFrame: {
    paddingHorizontal: 16,
    paddingTop: 16,
  } as ViewStyle,
  contentContainer: {
    gap: 12,
  } as ViewStyle,
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  } as ViewStyle,
}

export const FilterSheet = React.memo(function FilterSheet({
  open,
  onClose,
  filters,
  isHydrated,
  allInstruments,
  availableMonths,
  onTimeWindowChange,
  onMonthChange,
  onCategoriesChange,
  onPaymentMethodsChange,
  onPaymentInstrumentsChange,
  onSearchChange,
  onAmountRangeChange,
  _onReset,
}: FilterSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  // Local draft state
  const [draftTimeWindow, setDraftTimeWindow] = useState<TimeWindow>(filters.timeWindow)
  const [draftSelectedMonth, setDraftSelectedMonth] = useState<string | null>(
    filters.selectedMonth
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

  // Sync draft with props when opening
  React.useEffect(() => {
    if (open) {
      setDraftTimeWindow(filters.timeWindow)
      setDraftSelectedMonth(filters.selectedMonth)
      setDraftCategories(filters.selectedCategories)
      setDraftPaymentMethods(filters.selectedPaymentMethods)
      setDraftPaymentInstruments(filters.selectedPaymentInstruments)
      setDraftSearchQuery(filters.searchQuery)
      setDraftMinAmount(filters.minAmount)
      setDraftMaxAmount(filters.maxAmount)
    }
  }, [open, filters])

  const handleMonthChange = useCallback((month: string | null) => {
    setDraftSelectedMonth(month)
    if (month) {
      setDraftTimeWindow("all")
    }
  }, [])

  // Check if payment instrument filter should be shown
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

  // Prune instrument selection when payment methods change
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

  const handleApply = useCallback(() => {
    onTimeWindowChange(draftTimeWindow)
    onMonthChange(draftSelectedMonth)
    onCategoriesChange(draftCategories)
    onPaymentMethodsChange(draftPaymentMethods)
    onPaymentInstrumentsChange(draftPaymentInstruments)
    onSearchChange(draftSearchQuery)
    onAmountRangeChange(draftMinAmount, draftMaxAmount)
    onClose()
  }, [
    draftTimeWindow,
    draftSelectedMonth,
    draftCategories,
    draftPaymentMethods,
    draftPaymentInstruments,
    draftSearchQuery,
    draftMinAmount,
    draftMaxAmount,
    onTimeWindowChange,
    onMonthChange,
    onCategoriesChange,
    onPaymentMethodsChange,
    onPaymentInstrumentsChange,
    onSearchChange,
    onAmountRangeChange,
    onClose,
  ])

  const handleResetDraft = useCallback(() => {
    setDraftTimeWindow("all")
    setDraftSelectedMonth(null)
    setDraftCategories([])
    setDraftPaymentMethods([])
    setDraftPaymentInstruments([])
    setDraftSearchQuery("")
    setDraftMinAmount(null)
    setDraftMaxAmount(null)
  }, [])

  if (!open) return null

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) handleApply()
      }}
      snapPoints={[90]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Frame style={layoutStyles.sheetFrame} bg="$background">
        <Sheet.Handle />

        <YStack
          gap="$3"
          style={{ ...layoutStyles.contentContainer, flex: 1 } as ViewStyle}
        >
          <XStack style={layoutStyles.headerRow}>
            <H4>{t("history.filterSheet.title")}</H4>
            <XStack gap="$2" style={{ alignItems: "center" } as ViewStyle}>
              <Button size="$3" chromeless onPress={handleResetDraft}>
                {t("common.reset")}
              </Button>
              <Button
                size="$3"
                chromeless
                icon={X}
                onPress={handleApply}
                aria-label={t("common.close")}
              />
            </XStack>
          </XStack>

          <ScrollView showsVerticalScrollIndicator={false} flex={1}>
            <YStack gap="$2" pb="$6">
              {!isHydrated && (
                <Text color="$color" opacity={0.6} fontSize="$3">
                  {t("history.filterSheet.loading")}
                </Text>
              )}

              <CollapsibleSection title={t("history.filterSheet.time")}>
                <TimeWindowSelector
                  value={draftTimeWindow}
                  onChange={setDraftTimeWindow}
                />
              </CollapsibleSection>

              <CollapsibleSection title={t("history.filterSheet.month")}>
                <MonthSelector
                  value={draftSelectedMonth}
                  availableMonths={availableMonths}
                  onChange={handleMonthChange}
                />
              </CollapsibleSection>

              <CollapsibleSection title={t("history.filterSheet.search")}>
                <SearchFilter value={draftSearchQuery} onChange={setDraftSearchQuery} />
              </CollapsibleSection>

              <CollapsibleSection title={t("history.filterSheet.amountRange")}>
                <AmountRangeFilter
                  minAmount={draftMinAmount}
                  maxAmount={draftMaxAmount}
                  onChange={(min, max) => {
                    setDraftMinAmount(min)
                    setDraftMaxAmount(max)
                  }}
                />
              </CollapsibleSection>

              <CollapsibleSection title={t("history.filterSheet.category")}>
                <CategoryFilter
                  selectedCategories={draftCategories}
                  onChange={setDraftCategories}
                />
              </CollapsibleSection>

              <CollapsibleSection title={t("history.filterSheet.paymentMethod")}>
                <PaymentMethodFilter
                  selected={draftPaymentMethods}
                  onChange={handlePaymentMethodsChange}
                />
              </CollapsibleSection>

              {showPaymentInstrumentFilter && (
                <CollapsibleSection title={t("history.filterSheet.paymentInstrument")}>
                  <PaymentInstrumentFilter
                    instruments={allInstruments}
                    selectedPaymentMethods={draftPaymentMethods}
                    selected={draftPaymentInstruments}
                    onChange={setDraftPaymentInstruments}
                  />
                </CollapsibleSection>
              )}
            </YStack>
          </ScrollView>

          <XStack
            gap="$2"
            style={
              {
                justifyContent: "flex-end",
                paddingBottom: Math.max(insets.bottom, 8),
                paddingTop: 8,
              } as ViewStyle
            }
          >
            <Button size="$4" themeInverse onPress={handleApply}>
              {t("common.apply")}
            </Button>
          </XStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
})
