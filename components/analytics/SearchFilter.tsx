import { useState, useEffect } from "react"
import { XStack, Input, Button } from "tamagui"
import { X } from "@tamagui/lucide-icons"

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
    <XStack gap="$2" style={{ alignItems: "center" }}>
      <Input
        flex={1}
        value={inputValue}
        onChangeText={setInputValue}
        placeholder="Search notes, categories, payment methods..."
      />
      {inputValue.length > 0 && (
        <Button
          size="$2"
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
