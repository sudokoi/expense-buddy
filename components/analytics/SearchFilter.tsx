import { useState, useEffect } from "react"
import { View } from "react-native"
import { Input } from "../ui/Input"
import { X } from "lucide-react-native"
import { UI_ICON_SIZE } from "../../constants/ui-tokens"
import { IconActionButton } from "../ui/IconActionButton"
import { useTranslation } from "react-i18next"

interface SearchFilterProps {
  value: string
  onChange: (value: string) => void
  debounceMs?: number
}

export function SearchFilter({ value, onChange, debounceMs = 300 }: SearchFilterProps) {
  const { t } = useTranslation()
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
    <View className="flex-row items-center gap-2">
      <Input
        className="flex-1 bg-background"
        value={inputValue}
        onChangeText={setInputValue}
        placeholder={t("analytics.filters.search")}
        accessibilityLabel={t("analytics.filters.search")}
      />
      {inputValue.length > 0 && (
        <IconActionButton
          icon={<X size={UI_ICON_SIZE.small} />}
          onPress={() => {
            setInputValue("")
            onChange("")
          }}
          tooltip={t("common.clearSearch")}
          accessibilityLabel={t("common.clearSearch")}
        />
      )}
    </View>
  )
}
