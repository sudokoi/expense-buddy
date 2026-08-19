import { useState } from "react"
import { Text, View } from "react-native"
import { Input } from "../ui/Input"
import { getCurrencySymbol } from "../../utils/currency"
import { useSettings } from "../../stores/hooks"
import { getAmountInputProps, parseAmountInput } from "../../utils/amount-input"
import { useTranslation } from "react-i18next"

interface AmountRangeFilterProps {
  minAmount: number | null
  maxAmount: number | null
  onChange: (min: number | null, max: number | null) => void
  error?: string
}

export function AmountRangeFilter({
  minAmount,
  maxAmount,
  onChange,
  error,
}: AmountRangeFilterProps) {
  const { settings } = useSettings()
  const { t } = useTranslation()
  const symbol = getCurrencySymbol(settings.defaultCurrency)
  const amountInputProps = getAmountInputProps(settings.enableMathExpressions)

  const [min, setMin] = useState(minAmount?.toString() ?? "")
  const [max, setMax] = useState(maxAmount?.toString() ?? "")

  const handleBlur = () => {
    const minResult = min
      ? parseAmountInput(min, {
          allowMathExpressions: settings.enableMathExpressions,
          allowZero: true,
        })
      : null
    const maxResult = max
      ? parseAmountInput(max, {
          allowMathExpressions: settings.enableMathExpressions,
          allowZero: true,
        })
      : null
    const minNum = minResult?.success ? (minResult.value ?? null) : null
    const maxNum = maxResult?.success ? (maxResult.value ?? null) : null
    onChange(minNum, maxNum)
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Input
          className="flex-1 bg-background"
          value={min}
          onChangeText={setMin}
          onBlur={handleBlur}
          placeholder={`${symbol} Min`}
          keyboardType={amountInputProps.keyboardType}
          inputMode={amountInputProps.inputMode}
          accessibilityLabel={t("analytics.filters.minAmount")}
        />
        <Text className="text-foreground">to</Text>
        <Input
          className="flex-1 bg-background"
          value={max}
          onChangeText={setMax}
          onBlur={handleBlur}
          placeholder={`${symbol} Max`}
          keyboardType={amountInputProps.keyboardType}
          inputMode={amountInputProps.inputMode}
          accessibilityLabel={t("analytics.filters.maxAmount")}
        />
      </View>
      {error && <Text className="text-xs text-error">{error}</Text>}
    </View>
  )
}
