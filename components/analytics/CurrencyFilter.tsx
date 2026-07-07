import { memo } from "react"
import { XStack, Button } from "tamagui"
import { ScrollView } from "react-native"
import { useTranslation } from "react-i18next"
import { getCurrencySymbol } from "../../utils/currency"
import { UI_SPACE, UI_BORDER_WIDTH } from "../../constants/ui-tokens"

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
      <XStack gap="$control">
        <Button
          size="$chip"
          px="$control"
          theme={isDefaultSelected ? "accent" : undefined}
          onPress={() => onChange(null)}
          borderColor="$borderColor"
          borderWidth={!isDefaultSelected ? UI_BORDER_WIDTH.thin : 0}
        >
          {t("common.default")} ({getCurrencySymbol(defaultCurrency)})
        </Button>

        {availableCurrencies.map((currency) => {
          const isSelected = selectedCurrency === currency

          return (
            <Button
              key={currency}
              size="$chip"
              px="$control"
              theme={isSelected ? "accent" : undefined}
              onPress={() => onChange(currency)}
              borderColor="$borderColor"
              borderWidth={!isSelected ? UI_BORDER_WIDTH.thin : 0}
            >
              {currency} ({getCurrencySymbol(currency)})
            </Button>
          )
        })}
      </XStack>
    </ScrollView>
  )
})

export type { CurrencyFilterProps }
