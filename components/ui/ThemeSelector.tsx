import { View, Text } from "react-native"
import { Sun, Moon, Smartphone } from "lucide-react-native"
import { Pressable } from "react-native"
import { useTranslation } from "react-i18next"
import { ThemePreference } from "../../services/settings-manager"
import { Card } from "./Card"
import {
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"
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
    <Card className="flex-row gap-1 p-1 rounded-control">
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
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            className="flex-1 min-h-12"
          >
            <View
              className="flex-1 items-center justify-center gap-2 rounded-control p-2"
              style={{
                borderWidth: UI_BORDER_WIDTH.normal,
                backgroundColor: isSelected ? theme.muted : "transparent",
                borderColor: isSelected ? theme.accent : "transparent",
              }}
            >
              <Icon
                size={UI_ICON_SIZE.regular}
                color={theme.foreground}
                style={{ opacity: isSelected ? 1 : UI_OPACITY.medium }}
              />
              <Text
                className="text-center text-sm text-foreground"
                style={{
                  fontWeight: isSelected
                    ? UI_FONT_WEIGHT.semiBold
                    : UI_FONT_WEIGHT.normal,
                  opacity: isSelected ? 1 : UI_OPACITY.medium,
                }}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        )
      })}
    </Card>
  )
}

export type { ThemeSelectorProps }
