import { useState } from "react"
import { XStack, Input, Text, YStack } from "tamagui"
import { getCurrencySymbol } from "../../utils/currency"
import { useSettings } from "../../stores/hooks"
import { getAmountInputProps, parseAmountInput } from "../../utils/amount-input"

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
    <YStack gap="$control">
      <XStack gap="$control" style={{ alignItems: "center" }}>
        <Input
          flex={1}
          value={min}
          onChangeText={setMin}
          onBlur={handleBlur}
          placeholder={`${symbol} Min`}
          keyboardType={amountInputProps.keyboardType}
          inputMode={amountInputProps.inputMode}
        />
        <Text>to</Text>
        <Input
          flex={1}
          value={max}
          onChangeText={setMax}
          onBlur={handleBlur}
          placeholder={`${symbol} Max`}
          keyboardType={amountInputProps.keyboardType}
          inputMode={amountInputProps.inputMode}
        />
      </XStack>
      {error && (
        <Text color="$red10" fontSize="$caption">
          {error}
        </Text>
      )}
    </YStack>
  )
}
