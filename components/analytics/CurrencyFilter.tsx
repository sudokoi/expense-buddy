import { memo } from "react"
import { ScrollView, Text, View } from "react-native"
import { Button } from "../ui/Button"
import { useTranslation } from "react-i18next"
import { getCurrencySymbol } from "../../utils/currency"
import { UI_SPACE } from "../../constants/ui-tokens"

interface CurrencyFilterProps {
  availableCurrencies: string[]
  selectedCurrency: string | null
  /** Currency used when no explicit selection is made (auto). Shown on the Default chip. */
  defaultCurrency: string
  onChange: (currency: string | null) => void
}

const styles = {
  scrollView: {
    marginBottom: UI_SPACE.gutter,
  },
  contentContainer: {
    paddingHorizontal: UI_SPACE.micro,
  },
} as const

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
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      <View className="flex-row gap-2">
        <Button
          size="chip"
          className="px-2"
          variant={isDefaultSelected ? "accent" : "outline"}
          onPress={() => onChange(null)}
        >
          <Text>
            {t("common.default")} ({getCurrencySymbol(defaultCurrency)})
          </Text>
        </Button>

        {availableCurrencies.map((currency) => {
          const isSelected = selectedCurrency === currency

          return (
            <Button
              key={currency}
              size="chip"
              className="px-2"
              variant={isSelected ? "accent" : "outline"}
              onPress={() => onChange(currency)}
            >
              <Text>
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
