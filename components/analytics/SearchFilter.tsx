import { useState, useEffect } from "react"
import { XStack, Input, Button } from "tamagui"
import { X } from "@tamagui/lucide-icons-2"
import { ACCENT_COLORS } from "../../constants/theme-colors"
import { UI_BORDER_WIDTH } from "../../constants/ui-tokens"

interface SearchFilterProps {
  value: string
  onChange: (value: string) => void
  debounceMs?: number
}

export function SearchFilter({ value, onChange, debounceMs = 300 }: SearchFilterProps) {
  const [inputValue, setInputValue] = useState(value)

  // Debounce the actual filter update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== value) {
        onChange(inputValue)
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [inputValue, debounceMs, onChange, value])

  // Sync external value changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  return (
    <XStack gap="$control" style={{ alignItems: "center" }}>
      <Input
        flex={1}
        bg="$background"
        size="$control"
        borderWidth={UI_BORDER_WIDTH.normal}
        borderColor="$borderColor"
        focusStyle={{
          borderColor: ACCENT_COLORS.primary,
        }}
        value={inputValue}
        onChangeText={setInputValue}
        placeholder="Search notes, categories, payment methods..."
        placeholderTextColor="$color"
      />
      {inputValue.length > 0 && (
        <Button
          size="$chip"
          circular
          icon={X}
          onPress={() => {
            setInputValue("")
            onChange("")
          }}
        />
      )}
    </XStack>
  )
}
