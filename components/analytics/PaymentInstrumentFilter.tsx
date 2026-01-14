import { memo, useCallback, useMemo } from "react"
import { XStack, Button } from "tamagui"
import { ScrollView, ViewStyle } from "react-native"
import type { PaymentInstrument } from "../../types/payment-instrument"
import {
  PAYMENT_INSTRUMENT_METHODS,
  formatPaymentInstrumentLabel,
  getActivePaymentInstruments,
} from "../../services/payment-instruments"
import type { PaymentMethodSelectionKey } from "./PaymentMethodFilter"
import {
  PaymentInstrumentSelectionKey,
  makePaymentInstrumentSelectionKey,
} from "../../utils/analytics-calculations"

interface PaymentInstrumentFilterProps {
  instruments: PaymentInstrument[]
  selectedPaymentMethods: PaymentMethodSelectionKey[]
  selected: PaymentInstrumentSelectionKey[]
  onChange: (selected: PaymentInstrumentSelectionKey[]) => void
}

const styles = {
  scrollView: {
    marginBottom: 16,
  } as ViewStyle,
  contentContainer: {
    paddingHorizontal: 4,
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  } as ViewStyle,
}

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
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      <XStack gap="$2">
        <Button
          size="$2"
          themeInverse={isAllSelected}
          bordered={!isAllSelected}
          onPress={handleAllPress}
        >
          All
        </Button>

        {chipItems.map((item) => {
          const isSelected = selected.includes(item.key)
          return (
            <Button
              key={item.key}
              size="$2"
              themeInverse={isSelected}
              bordered={!isSelected}
              onPress={() => handleToggle(item.key)}
            >
              {item.label}
            </Button>
          )
        })}
      </XStack>
    </ScrollView>
  )
})

export type { PaymentInstrumentFilterProps }
