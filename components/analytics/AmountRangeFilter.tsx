import { useState } from "react"
import { XStack, Input, Text, YStack } from "tamagui"
import { getCurrencySymbol } from "../../utils/currency"
import { useSettings } from "../../stores/hooks"

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

  const [min, setMin] = useState(minAmount?.toString() ?? "")
  const [max, setMax] = useState(maxAmount?.toString() ?? "")

  const handleBlur = () => {
    const minNum = min ? parseFloat(min) : null
    const maxNum = max ? parseFloat(max) : null
    onChange(minNum, maxNum)
  }

  return (
    <YStack gap="$2">
      <XStack gap="$2" style={{ alignItems: "center" }}>
        <Input
          flex={1}
          value={min}
          onChangeText={setMin}
          onBlur={handleBlur}
          placeholder={`${symbol} Min`}
          keyboardType="numeric"
        />
        <Text>to</Text>
        <Input
          flex={1}
          value={max}
          onChangeText={setMax}
          onBlur={handleBlur}
          placeholder={`${symbol} Max`}
          keyboardType="numeric"
        />
      </XStack>
      {error && (
        <Text color="$red10" fontSize="$2">
          {error}
        </Text>
      )}
    </YStack>
  )
}
