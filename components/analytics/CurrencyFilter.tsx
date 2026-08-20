import { memo } from "react"
import { useTranslation } from "react-i18next"
import { getCurrencySymbol } from "../../utils/currency"
import { FilterChip, FilterChipBar } from "./FilterChipBar"

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
    <FilterChipBar>
      <FilterChip
        label={`${t("common.default")} (${getCurrencySymbol(defaultCurrency)})`}
        selected={isDefaultSelected}
        onPress={() => onChange(null)}
      />

      {availableCurrencies.map((currency) => {
        const isSelected = selectedCurrency === currency

        return (
          <FilterChip
            key={currency}
            label={`${currency} (${getCurrencySymbol(currency)})`}
            selected={isSelected}
            onPress={() => onChange(currency)}
          />
        )
      })}
    </FilterChipBar>
  )
})

export type { CurrencyFilterProps }
