import { XStack, Button } from "tamagui"
import { getCurrencySymbol } from "../../utils/currency"

interface CurrencyFilterProps {
  availableCurrencies: string[]
  selectedCurrency: string | null
  effectiveCurrency: string
  onChange: (currency: string | null) => void
}

export function CurrencyFilter({
  availableCurrencies,
  selectedCurrency,
  effectiveCurrency,
  onChange,
}: CurrencyFilterProps) {
  if (availableCurrencies.length <= 1) return null

  return (
    <XStack flexWrap="wrap" gap="$2">
      {availableCurrencies.map((currency) => {
        const isSelected =
          selectedCurrency === currency ||
          (!selectedCurrency && effectiveCurrency === currency)

        return (
          <Button
            key={currency}
            size="$3"
            themeInverse={isSelected}
            onPress={() => onChange(currency)}
            bordered
          >
            {currency} ({getCurrencySymbol(currency)})
          </Button>
        )
      })}
    </XStack>
  )
}
