import { memo, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { FilterChip, FilterChipBar } from "./FilterChipBar"
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
        label: t("instruments.dropdown.othersLabel", {
          method: methodShortLabel(method, t),
        }),
      })

      for (const inst of methodActive) {
        items.push({
          key: makePaymentInstrumentSelectionKey(method, inst.id),
          label: `${methodShortLabel(method, t)} • ${formatPaymentInstrumentLabel(inst)}`,
        })
      }
    }

    return items
  }, [active, allowedMethods, t])

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
    <FilterChipBar>
      <FilterChip
        label={t("common.all")}
        selected={isAllSelected}
        onPress={handleAllPress}
      />

      {chipItems.map((item) => {
        const isSelected = selected.includes(item.key)
        return (
          <FilterChip
            key={item.key}
            label={item.label}
            selected={isSelected}
            onPress={() => handleToggle(item.key)}
          />
        )
      })}
    </FilterChipBar>
  )
})

export type { PaymentInstrumentFilterProps }
