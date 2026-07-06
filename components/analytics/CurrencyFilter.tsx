import { XStack, Button } from "tamagui"
import { useTranslation } from "react-i18next"
import { getCurrencySymbol } from "../../utils/currency"
import { UI_BORDER_WIDTH } from "../../constants/ui-tokens"

interface CurrencyFilterProps {
  availableCurrencies: string[]
  selectedCurrency: string | null
  /** Currency used when no explicit selection is made (auto). Shown on the Default chip. */
  defaultCurrency: string
  onChange: (currency: string | null) => void
}

export function CurrencyFilter({
  availableCurrencies,
  selectedCurrency,
  defaultCurrency,
  onChange,
}: CurrencyFilterProps) {
  const { t } = useTranslation()

  if (availableCurrencies.length <= 1) return null

  // No explicit selection means "auto / default" (resolved to the default currency).
  const isDefaultSelected = !selectedCurrency

  return (
    <XStack flexWrap="wrap" gap="$control">
      <Button
        size="$compact"
        px="$section"
        theme={isDefaultSelected ? "accent" : undefined}
        onPress={() => onChange(null)}
        borderWidth={UI_BORDER_WIDTH.thin}
        borderColor="$borderColor"
      >
        {t("common.default")} ({getCurrencySymbol(defaultCurrency)})
      </Button>

      {availableCurrencies.map((currency) => {
        const isSelected = selectedCurrency === currency

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
