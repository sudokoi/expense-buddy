import { memo } from "react"
import { ScrollView, Text, View } from "react-native"
import { Button } from "../ui/Button"
import { useTranslation } from "react-i18next"
import { getCurrencySymbol } from "../../utils/currency"
import { useThemeColors } from "../../hooks/use-theme-colors"

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
  const theme = useThemeColors()

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
          variant="outline"
          style={isDefaultSelected ? { backgroundColor: theme.accent } : undefined}
          onPress={() => onChange(null)}
          accessibilityState={{ selected: isDefaultSelected }}
        >
          <Text className="text-foreground">
            {t("common.default")} ({getCurrencySymbol(defaultCurrency)})
          </Text>
        </Button>

        {availableCurrencies.map((currency) => {
          const isSelected = selectedCurrency === currency

          return (
            <Button
              key={currency}
              size="chip"
              variant="outline"
              style={isSelected ? { backgroundColor: theme.accent } : undefined}
              onPress={() => onChange(currency)}
              accessibilityState={{ selected: isSelected }}
            >
              <Text className="text-foreground">
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
