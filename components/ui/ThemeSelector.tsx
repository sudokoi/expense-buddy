import { Text, Card, View, useTheme } from "tamagui"
import { Sun, Moon, Smartphone } from "@tamagui/lucide-icons"
import { Pressable, ViewStyle } from "react-native"
import { ThemePreference } from "../../context/SettingsContext"
import { getColorValue } from "../../tamagui.config"

interface ThemeSelectorProps {
  value: ThemePreference
  onChange: (theme: ThemePreference) => void
}

// Only use style prop for layout properties that Tamagui View doesn't support directly
const styles = {
  container: {
    flexDirection: "row",
  } as ViewStyle,
  segment: {
    flex: 1,
    minHeight: 44, // Accessibility: minimum touch target
  } as ViewStyle,
  segmentInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 8,
    borderRadius: 8,
  } as ViewStyle,
}

const ICON_SIZE = 18

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
 *
 * Displays three options: Light, Dark, and System Default
 * Uses icons (Sun, Moon, Smartphone) for visual clarity
 *
 * @param value - Current theme preference
 * @param onChange - Callback when theme selection changes
 */
export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const theme = useTheme()

  return (
    <Card bordered padding="$1" borderRadius="$4" gap="$1" style={styles.container}>
      {themeOptions.map(({ key, label, Icon }) => {
        const isSelected = value === key
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${label} theme`}
            style={({ pressed }) => [styles.segment, { opacity: pressed ? 0.8 : 1 }]}
          >
            <View
              flex={1}
              borderWidth={2}
              bg={isSelected ? "$backgroundFocus" : "transparent"}
              borderColor={
                isSelected ? getColorValue(theme.borderColorFocus) : "transparent"
              }
              style={styles.segmentInner}
            >
              <Icon
                size={ICON_SIZE}
                color={getColorValue(theme.color)}
                opacity={isSelected ? 1 : 0.7}
              />
              <Text
                fontSize="$3"
                fontWeight={isSelected ? "600" : "400"}
                color="$color"
                opacity={isSelected ? 1 : 0.7}
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
