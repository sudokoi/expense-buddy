import { Text, Card, View, useTheme } from "tamagui"
import { Sun, Moon, Smartphone } from "@tamagui/lucide-icons-2"
import { Pressable } from "react-native"
import { ThemePreference } from "../../services/settings-manager"
import { getColorValue } from "../../tamagui.config"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"

interface ThemeSelectorProps {
  value: ThemePreference
  onChange: (theme: ThemePreference) => void
}

// Only use style prop for layout properties that Tamagui View doesn't support directly
const styles = {
  container: {
    flexDirection: "row",
  },
  segment: {
    flex: 1,
    minHeight: 44, // Accessibility: minimum touch target
  },
  segmentInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: UI_SPACE.control,
    padding: UI_SPACE.control,
    borderRadius: UI_RADIUS.control,
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
    <Card
      borderWidth={UI_BORDER_WIDTH.thin}
      borderColor="$borderColor"
      p="$micro"
      rounded="$control"
      gap="$micro"
      style={styles.container}
    >
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
              flex={1}
              borderWidth={UI_BORDER_WIDTH.normal}
              bg={isSelected ? "$backgroundFocus" : "transparent"}
              borderColor={
                isSelected ? getColorValue(theme.borderColorFocus) : "transparent"
              }
              style={styles.segmentInner}
            >
              <Icon
                size={UI_ICON_SIZE.regular}
                color={getColorValue(theme.color)}
                opacity={isSelected ? 1 : UI_OPACITY.medium}
              />
              <Text
                fontSize="$body"
                fontWeight={isSelected ? UI_FONT_WEIGHT.semiBold : UI_FONT_WEIGHT.normal}
                color="$color"
                opacity={isSelected ? 1 : UI_OPACITY.medium}
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
