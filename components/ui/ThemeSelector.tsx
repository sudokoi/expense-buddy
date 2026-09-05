import { View, Text } from "react-native"
import { Sun, Moon, Smartphone } from "lucide-react-native"
import { Pressable } from "react-native"
import { useTranslation } from "react-i18next"
import { ThemePreference } from "../../services/settings-manager"
import { UI_FONT_WEIGHT, UI_BORDER_WIDTH, UI_ICON_SIZE } from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"

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
    <View className="max-w-full self-start flex-row flex-wrap gap-1 p-1 rounded-control border border-border bg-surface">
      {themeOptions.map(({ key, labelKey, Icon }) => {
        const isSelected = value === key
        const label = t(labelKey)
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            role="button"
            aria-selected={isSelected}
            aria-label={label}
            style={{
              borderWidth: UI_BORDER_WIDTH.thin,
              backgroundColor: isSelected ? theme.muted : "transparent",
              borderColor: isSelected ? theme.accent : "transparent",
            }}
            className="min-h-12 max-w-full flex-row items-center justify-center gap-2 rounded-control px-3 py-2 active:opacity-60"
          >
            <Icon
              size={UI_ICON_SIZE.regular}
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
          </Pressable>
        )
      })}
    </View>
  )
}

export type { ThemeSelectorProps }
