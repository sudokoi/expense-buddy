import { memo } from "react"
import { ScrollView, Text, View } from "react-native"
import { Button } from "../ui/Button"
import { useTranslation } from "react-i18next"
import { getCurrencySymbol } from "../../utils/currency"

interface CurrencyFilterProps {
  availableCurrencies: string[]
  selectedCurrency: string | null
  /** Currency used when no explicit selection is made (auto). Shown on the Default chip. */
  defaultCurrency: string
  onChange: (currency: string | null) => void
}

export const CurrencyFilter = memo(function CurrencyFilter({
  availableCurrencies,
  selectedCurrency,
  defaultCurrency,
  onChange,
}: CurrencyFilterProps) {
  const { t } = useTranslation()

  if (availableCurrencies.length <= 1) return null

  const isDefaultSelected = !selectedCurrency

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
          variant={isDefaultSelected ? "accent" : "outline"}
          onPress={() => onChange(null)}
          accessibilityState={{ selected: isDefaultSelected }}
        >
          <Text adjustsFontSizeToFit numberOfLines={1}>
            {t("common.default")} ({getCurrencySymbol(defaultCurrency)})
          </Text>
        </Button>

        {availableCurrencies.map((currency) => {
          const isSelected = selectedCurrency === currency

          return (
            <Button
              key={currency}
              size="chip"
              variant={isSelected ? "accent" : "outline"}
              onPress={() => onChange(currency)}
              accessibilityState={{ selected: isSelected }}
            >
              <Text adjustsFontSizeToFit numberOfLines={1}>
                {currency} ({getCurrencySymbol(currency)})
              </Text>
            </Button>
          )
        })}
      </View>
    </ScrollView>
  )
})

export type { CurrencyFilterProps }
