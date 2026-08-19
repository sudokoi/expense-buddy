import { memo, useCallback, useMemo } from "react"
import { ScrollView, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Button } from "../ui/Button"
import type { PaymentInstrument } from "../../types/payment-instrument"
import {
  PAYMENT_INSTRUMENT_METHODS,
  formatPaymentInstrumentLabel,
  getActivePaymentInstruments,
} from "../../services/payment-instruments"
import type { PaymentMethodSelectionKey } from "./PaymentMethodFilter"
import type { PaymentInstrumentSelectionKey } from "../../utils/analytics/filters"
import { makePaymentInstrumentSelectionKey } from "../../utils/analytics/filters"
import { methodShortLabel } from "../../utils/analytics/filter-summary"
import { useThemeColors } from "../../hooks/use-theme-colors"

interface PaymentInstrumentFilterProps {
  instruments: PaymentInstrument[]
  selectedPaymentMethods: PaymentMethodSelectionKey[]
  selected: PaymentInstrumentSelectionKey[]
  onChange: (selected: PaymentInstrumentSelectionKey[]) => void
}

/**
 * PaymentInstrumentFilter - Multi-select chips for filtering analytics by saved card/UPI instruments.
 * Empty selection means "All".
 */
export const PaymentInstrumentFilter = memo(function PaymentInstrumentFilter({
  instruments,
  selectedPaymentMethods,
  selected,
  onChange,
}: PaymentInstrumentFilterProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const isAllSelected = selected.length === 0

  const active = useMemo(() => getActivePaymentInstruments(instruments), [instruments])

  const allowedMethods = useMemo(() => {
    // Empty payment-method selection means "All" payment methods.
    if (selectedPaymentMethods.length === 0) {
      return new Set(PAYMENT_INSTRUMENT_METHODS)
    }

    const set = new Set<string>(selectedPaymentMethods)
    return new Set(PAYMENT_INSTRUMENT_METHODS.filter((m) => set.has(m)))
  }, [selectedPaymentMethods])

  const chipItems = useMemo(() => {
    const items: Array<{ key: PaymentInstrumentSelectionKey; label: string }> = []

    for (const method of PAYMENT_INSTRUMENT_METHODS) {
      if (!allowedMethods.has(method)) continue

      const methodActive = active
        .filter((i) => i.method === method)
        .sort((a, b) => a.nickname.localeCompare(b.nickname))

      // Only show instrument chips for a method if there is at least one configured instrument.
      if (methodActive.length === 0) continue

      // Always include an "Others" chip per method (covers missing/deleted/manual)
      items.push({
        key: makePaymentInstrumentSelectionKey(method, undefined),
        label: `${methodShortLabel(method)} • Others`,
      })

      for (const inst of methodActive) {
        items.push({
          key: makePaymentInstrumentSelectionKey(method, inst.id),
          label: `${methodShortLabel(method)} • ${formatPaymentInstrumentLabel(inst)}`,
        })
      }
    }

    return items
  }, [active, allowedMethods])

  const handleAllPress = useCallback(() => {
    onChange([])
  }, [onChange])

  const handleToggle = useCallback(
    (key: PaymentInstrumentSelectionKey) => {
      if (selected.includes(key)) {
        onChange(selected.filter((k) => k !== key))
      } else {
        onChange([...selected, key])
      }
    },
    [selected, onChange]
  )

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      className="mb-5"
      contentContainerStyle={{ paddingHorizontal: 4 }}
    >
      <View className="flex-row gap-2">
        <Button
          size="chip"
          variant="outline"
          style={isAllSelected ? { backgroundColor: theme.accent } : undefined}
          onPress={handleAllPress}
          accessibilityState={{ selected: isAllSelected }}
        >
          <Text className="text-foreground">{t("common.all")}</Text>
        </Button>

        {chipItems.map((item) => {
          const isSelected = selected.includes(item.key)
          return (
            <Button
              key={item.key}
              size="chip"
              variant="outline"
              style={isSelected ? { backgroundColor: theme.accent } : undefined}
              onPress={() => handleToggle(item.key)}
              accessibilityState={{ selected: isSelected }}
            >
              <Text className="text-foreground" numberOfLines={1}>
                {item.label}
              </Text>
            </Button>
          )
        })}
      </View>
    </ScrollView>
  )
})

export type { PaymentInstrumentFilterProps }
