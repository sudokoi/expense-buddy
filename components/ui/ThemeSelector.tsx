import { View, Text } from "react-native"
import { Sun, Moon, Smartphone } from "lucide-react-native"
import { Pressable } from "react-native"
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

const styles = {
  segment: {
    flex: 1,
    minHeight: 44, // Accessibility: minimum touch target
  },
} as const

interface ThemeOption {
  key: ThemePreference
  label: string
  Icon: typeof Sun
}

const themeOptions: ThemeOption[] = [
  { key: "light", label: "Light", Icon: Sun },
  { key: "dark", label: "Dark", Icon: Moon },
  { key: "system", label: "System", Icon: Smartphone },
]

/**
 * ThemeSelector - A segmented control for selecting theme preference
 */
export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const theme = useThemeColors()

  return (
    <Card className="flex-row gap-1 p-1 rounded-control">
      {themeOptions.map(({ key, label, Icon }) => {
        const isSelected = value === key
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            role="button"
            aria-selected={isSelected}
            aria-label={`${label} theme`}
            style={({ pressed }) => [styles.segment, { opacity: pressed ? 0.8 : 1 }]}
          >
            <View
              className="flex-1 flex-row items-center justify-center gap-2 rounded-control p-2"
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
                className="text-[13px] text-foreground"
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
