import { View } from "react-native"
import { Input } from "../ui/Input"
import { X } from "lucide-react-native"
import { UI_ICON_SIZE } from "../../constants/ui-tokens"
import { IconActionButton } from "../ui/IconActionButton"
import { useTranslation } from "react-i18next"

interface SearchFilterProps {
  value: string
  onChange: (value: string) => void
}

export function SearchFilter({ value, onChange }: SearchFilterProps) {
  const { t } = useTranslation()

  return (
    <View className="flex-row items-center gap-2">
      <Input
        className="flex-1 bg-background"
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        returnKeyType="search"
        placeholder={t("analytics.filters.search")}
        accessibilityLabel={t("analytics.filters.search")}
      />
      {value.length > 0 && (
        <IconActionButton
          icon={<X size={UI_ICON_SIZE.small} />}
          onPress={() => {
            onChange("")
          }}
          tooltip={t("common.clearSearch")}
          accessibilityLabel={t("common.clearSearch")}
        />
      )}
    </View>
  )
}
