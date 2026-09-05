import { useTranslation } from "react-i18next"
import { SelectionField } from "./SelectionField"
import { getCurrencySymbol } from "../../utils/currency"

interface CurrencySelectorProps {
  value: string
  onChange: (currency: string) => void
}

const currencies = ["INR", "USD", "GBP", "EUR", "JPY", "CAD", "AUD"]

export function CurrencySelector({ value, onChange }: CurrencySelectorProps) {
  const { t } = useTranslation()
  return (
    <SelectionField
      label={t("settings.localization.currency")}
      value={value}
      onChange={onChange}
      options={currencies.map((code) => ({
        value: code,
        label: `${code} · ${getCurrencySymbol(code)}`,
      }))}
    />
  )
}
