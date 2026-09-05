import { View, Text } from "react-native"
import { Sun, Moon, Smartphone } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { ThemePreference } from "../../services/settings-manager"
import { UI_FONT_WEIGHT, UI_ICON_SIZE } from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { CompactControl } from "./CompactControl"

interface ThemeSelectorProps {
  value: ThemePreference
  onChange: (theme: ThemePreference) => void
}

interface ThemeOption {
  key: ThemePreference
  labelKey: string
  Icon: typeof Sun
}

const themeOptions: ThemeOption[] = [
  { key: "light", labelKey: "settings.appearance.options.light", Icon: Sun },
  { key: "dark", labelKey: "settings.appearance.options.dark", Icon: Moon },
  { key: "system", labelKey: "settings.appearance.options.system", Icon: Smartphone },
]

/**
 * ThemeSelector - A segmented control for selecting theme preference
 */
export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()

  return (
    <View className="max-w-full self-start flex-row flex-wrap gap-x-2">
      {themeOptions.map(({ key, labelKey, Icon }) => {
        const isSelected = value === key
        const label = t(labelKey)
        return (
          <CompactControl
            key={key}
            onPress={() => onChange(key)}
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={label}
            surfaceStyle={{
              backgroundColor: isSelected ? theme.muted : theme.surface,
              borderColor: isSelected ? theme.accent : theme.border,
            }}
          >
            <Icon
              size={UI_ICON_SIZE.mini}
              color={isSelected ? theme.accent : theme.mutedForeground}
            />
            <Text
              className="shrink text-center text-sm text-foreground"
              style={{
                fontWeight: isSelected ? UI_FONT_WEIGHT.semiBold : UI_FONT_WEIGHT.normal,
              }}
            >
              {label}
            </Text>
          </CompactControl>
        )
      })}
    </View>
  )
}

export type { ThemeSelectorProps }
