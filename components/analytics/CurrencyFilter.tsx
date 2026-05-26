import { XStack, Button } from "tamagui"
import { getCurrencySymbol } from "../../utils/currency"
import { UI_BORDER_WIDTH } from "../../constants/ui-tokens"
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
    <XStack flexWrap="wrap" gap="$control">
      {availableCurrencies.map((currency) => {
        const isSelected =
          selectedCurrency === currency ||
          (!selectedCurrency && effectiveCurrency === currency)

        return (
          <Button
            key={currency}
            size="$compact"
            px="$section"
            theme={isSelected ? "accent" : undefined}
            onPress={() => onChange(currency)}
            borderWidth={UI_BORDER_WIDTH.thin}
            borderColor="$borderColor"
          >
            {currency} ({getCurrencySymbol(currency)})
          </Button>
        )
      })}
    </XStack>
  )
}
