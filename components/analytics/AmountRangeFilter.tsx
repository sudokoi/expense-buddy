import { Text, View } from "react-native"
import { Input } from "../ui/Input"
import { getCurrencySymbol } from "../../utils/currency"
import { getAmountInputProps } from "../../utils/amount-input"
import { useTranslation } from "react-i18next"

interface AmountRangeFilterProps {
  min: string
  max: string
  currencyCode: string
  allowMathExpressions: boolean
  onMinChange: (value: string) => void
  onMaxChange: (value: string) => void
  error?: string
}

export function AmountRangeFilter({
  min,
  max,
  currencyCode,
  allowMathExpressions,
  onMinChange,
  onMaxChange,
  error,
}: AmountRangeFilterProps) {
  const { t } = useTranslation()
  const inputProps = getAmountInputProps(allowMathExpressions)
  const symbol = getCurrencySymbol(currencyCode)
  return (
    <View className="gap-2">
      <View className="flex-row gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-xs text-muted-foreground">
            {t("analytics.filters.minAmount")} ({symbol})
          </Text>
          <Input
            value={min}
            onChangeText={onMinChange}
            placeholder="0"
            {...inputProps}
            accessibilityLabel={t("analytics.filters.minAmount")}
            className={error ? "border-error" : undefined}
          />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-xs text-muted-foreground">
            {t("analytics.filters.maxAmount")} ({symbol})
          </Text>
          <Input
            value={max}
            onChangeText={onMaxChange}
            placeholder={t("analytics.filters.noLimit")}
            {...inputProps}
            accessibilityLabel={t("analytics.filters.maxAmount")}
            className={error ? "border-error" : undefined}
          />
        </View>
      </View>
      {error ? (
        <Text className="text-xs text-error" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  )
}
