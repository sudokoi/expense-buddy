import { Text, Card, View, useTheme } from "tamagui"
import { Globe, Languages } from "@tamagui/lucide-icons"
import { Pressable, ViewStyle } from "react-native"
import { getColorValue } from "../../tamagui.config"

interface LanguageSelectorProps {
  value: string
  onChange: (lang: string) => void
}

// Only use style prop for layout properties that Tamagui View doesn't support directly
const styles = {
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
  } as ViewStyle,
  segment: {
    flexBasis: "50%", // 2 items per row
    minHeight: 44, // Accessibility: minimum touch target
  } as ViewStyle,
  segmentInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 8,
    borderRadius: 8,
    margin: 2,
  } as ViewStyle,
}

const ICON_SIZE = 18

interface LanguageOption {
  key: string
  label: string
  Icon: typeof Globe
}

const languageOptions: LanguageOption[] = [
  { key: "en-US", label: "English (US)", Icon: Globe },
  { key: "en-GB", label: "English (UK)", Icon: Globe },
  { key: "en-IN", label: "English (IN)", Icon: Globe },
  { key: "hi", label: "Hindi (हिंदी)", Icon: Languages },
]

/**
 * LanguageSelector - A selector for app language
 *
 * Displays options: US, UK, IN English, and Hindi
 *
 * @param value - Current language code
 * @param onChange - Callback when language selection changes
 */
export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const theme = useTheme()

  return (
    <Card bordered padding="$1" borderRadius="$4" style={styles.container}>
      {languageOptions.map(({ key, label, Icon }) => {
        const isSelected = value === key
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Select ${label}`}
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

export type { LanguageSelectorProps }
