import { memo, useCallback, useMemo, useRef, useState } from "react"
import { YStack, XStack, Button, Sheet, H4, ScrollView, Text } from "tamagui"
import { ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { X } from "@tamagui/lucide-icons"
import type { TimeWindow } from "../../utils/analytics-calculations"
import type { PaymentInstrumentSelectionKey } from "../../utils/analytics-calculations"
import type { PaymentMethodSelectionKey } from "./PaymentMethodFilter"
import type { PaymentInstrument } from "../../types/payment-instrument"
import {
  PAYMENT_INSTRUMENT_METHODS,
  getActivePaymentInstruments,
} from "../../services/payment-instruments"
import { CollapsibleSection } from "./CollapsibleSection"
import { TimeWindowSelector } from "./TimeWindowSelector"
import { CategoryFilter } from "./CategoryFilter"
import { PaymentMethodFilter } from "./PaymentMethodFilter"
import { PaymentInstrumentFilter } from "./PaymentInstrumentFilter"
import { CurrencyFilter } from "./CurrencyFilter"
import { useTranslation } from "react-i18next"

const layoutStyles = {
  sheetFrame: {
    padding: 16,
  } as ViewStyle,
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  contentContainer: {
    marginTop: 8,
  } as ViewStyle,
} as const

interface AnalyticsFiltersSheetProps {
  open: boolean
  isHydrating?: boolean
  timeWindow: TimeWindow
  selectedCategories: string[]
  selectedPaymentMethods: PaymentMethodSelectionKey[]
  paymentInstruments: PaymentInstrument[]
  selectedPaymentInstruments: PaymentInstrumentSelectionKey[]

  onApply: (next: {
    timeWindow: TimeWindow
    selectedCategories: string[]
    selectedPaymentMethods: PaymentMethodSelectionKey[]
    selectedPaymentInstruments: PaymentInstrumentSelectionKey[]
    selectedCurrency: string | null
  }) => void
  availableCurrencies: string[]
  selectedCurrency: string | null
  effectiveCurrency: string
}

export const AnalyticsFiltersSheet = memo(function AnalyticsFiltersSheet({
  open,
  isHydrating,
  timeWindow,
  selectedCategories,
  selectedPaymentMethods,
  paymentInstruments,
  selectedPaymentInstruments,
  onApply,
  availableCurrencies,
  selectedCurrency,
  effectiveCurrency,
}: AnalyticsFiltersSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [draftTimeWindow, setDraftTimeWindow] = useState<TimeWindow>(timeWindow)
  const [draftCategories, setDraftCategories] = useState<string[]>(selectedCategories)
  const [draftPaymentMethods, setDraftPaymentMethods] =
    useState<PaymentMethodSelectionKey[]>(selectedPaymentMethods)
  const [draftPaymentInstruments, setDraftPaymentInstruments] = useState<
    PaymentInstrumentSelectionKey[]
  >(selectedPaymentInstruments)
  const [draftCurrency, setDraftCurrency] = useState<string | null>(selectedCurrency)

  const prevOpenRef = useRef(open)
  if (open && !prevOpenRef.current) {
    prevOpenRef.current = open

    if (draftTimeWindow !== timeWindow) {
      setDraftTimeWindow(timeWindow)
    }
    if (draftCategories !== selectedCategories) {
      setDraftCategories(selectedCategories)
    }
    if (draftPaymentMethods !== selectedPaymentMethods) {
      setDraftPaymentMethods(selectedPaymentMethods)
    }
    if (draftPaymentInstruments !== selectedPaymentInstruments) {
      setDraftPaymentInstruments(selectedPaymentInstruments)
    }
    if (draftCurrency !== selectedCurrency) {
      setDraftCurrency(selectedCurrency)
    }
  } else if (!open && prevOpenRef.current) {
    prevOpenRef.current = open
  }

  const showPaymentInstrumentFilter = useMemo(() => {
    const active = getActivePaymentInstruments(paymentInstruments)
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
  }, [paymentInstruments, draftPaymentMethods])

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
      setDraftPaymentMethods(next)
      setDraftPaymentInstruments((prev) => {
        // Reset instruments to "All" when payment methods are reset to "All".
        if (next.length === 0) return []
        return prunePaymentInstrumentSelection(next, prev)
      })
    },
    [prunePaymentInstrumentSelection]
  )

  const frameStyle = useMemo(
    () => ({
      ...layoutStyles.sheetFrame,
      paddingBottom: 0,
    }),
    []
  )

  const handleApply = useCallback(() => {
    onApply({
      timeWindow: draftTimeWindow,
      selectedCategories: draftCategories,
      selectedPaymentMethods: draftPaymentMethods,
      selectedPaymentInstruments: draftPaymentInstruments,
      selectedCurrency: draftCurrency,
    })
  }, [
    onApply,
    draftTimeWindow,
    draftCategories,
    draftPaymentMethods,
    draftPaymentInstruments,
    draftCurrency,
  ])

  const handleResetDraft = useCallback(() => {
    setDraftTimeWindow("7d")
    setDraftCategories([])
    setDraftPaymentMethods([])
    setDraftPaymentInstruments([])
    setDraftCurrency(null) // Reset to auto
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
      <Sheet.Frame style={frameStyle} bg="$background">
        <Sheet.Handle />

        <YStack
          gap="$3"
          style={{ ...layoutStyles.contentContainer, flex: 1 } as ViewStyle}
        >
          <XStack style={layoutStyles.headerRow}>
            <H4>{t("analytics.filtersModal.title")}</H4>
            <XStack gap="$2" style={{ alignItems: "center" } as ViewStyle}>
              <Button size="$3" chromeless onPress={handleResetDraft}>
                {t("analytics.filtersModal.reset")}
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
              {isHydrating ? (
                <Text color="$color" opacity={0.6} fontSize="$3">
                  {t("analytics.filtersModal.loading")}
                </Text>
              ) : null}

              <CollapsibleSection title={t("analytics.filtersModal.time")}>
                <TimeWindowSelector
                  value={draftTimeWindow}
                  onChange={setDraftTimeWindow}
                />
              </CollapsibleSection>

              {availableCurrencies.length > 1 && (
                <CollapsibleSection title={t("settings.localization.currency")}>
                  <CurrencyFilter
                    availableCurrencies={availableCurrencies}
                    selectedCurrency={draftCurrency}
                    effectiveCurrency={effectiveCurrency}
                    onChange={setDraftCurrency}
                  />
                </CollapsibleSection>
              )}

              <CollapsibleSection title={t("analytics.filtersModal.category")}>
                <CategoryFilter
                  selectedCategories={draftCategories}
                  onChange={setDraftCategories}
                />
              </CollapsibleSection>

              <CollapsibleSection title={t("analytics.filtersModal.paymentMethod")}>
                <PaymentMethodFilter
                  selected={draftPaymentMethods}
                  onChange={handlePaymentMethodsChange}
                />
              </CollapsibleSection>

              {showPaymentInstrumentFilter && (
                <CollapsibleSection title={t("analytics.filtersModal.paymentInstrument")}>
                  <PaymentInstrumentFilter
                    instruments={paymentInstruments}
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
              {t("analytics.filtersModal.apply")}
            </Button>
          </XStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
})

export type { AnalyticsFiltersSheetProps }
