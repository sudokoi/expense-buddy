import { Text, Card, View, useTheme } from "tamagui"
import { Globe, Languages } from "@tamagui/lucide-icons-2"
import { Pressable } from "react-native"
import { getColorValue } from "../../tamagui.config"
import { useTranslation } from "react-i18next"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"

interface LanguageSelectorProps {
  value: string
  onChange: (lang: string) => void
}

// Only use style prop for layout properties that Tamagui View doesn't support directly
const styles = {
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  segment: {
    flexBasis: "50%", // 2 items per row
    minHeight: 44, // Accessibility: minimum touch target
  },
  segmentInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: UI_SPACE.control,
    padding: UI_SPACE.control,
    borderRadius: UI_RADIUS.control,
    margin: UI_SPACE.micro / 2,
  },
} as const

interface LanguageOption {
  key: string
  label: string
  Icon: typeof Globe
}

const languageOptions: LanguageOption[] = [
  { key: "system", label: "System Default", Icon: Globe },
  { key: "en-US", label: "English (US)", Icon: Globe },
  { key: "en-GB", label: "English (UK)", Icon: Globe },
  { key: "en-IN", label: "English (IN)", Icon: Globe },
  { key: "hi", label: "Hindi (हिंदी)", Icon: Languages },
  { key: "ja", label: "Japanese (日本語)", Icon: Languages },
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
  const { t } = useTranslation()

  const options = languageOptions.map((opt) => ({
    ...opt,
    label: opt.key === "system" ? t("settings.appearance.options.system") : opt.label,
  }))

  return (
    <Card
      borderWidth={UI_BORDER_WIDTH.thin}
      borderColor="$borderColor"
      p="$micro"
      rounded="$control"
      style={styles.container}
    >
      {options.map(({ key, label, Icon }) => {
        const isSelected = value === key
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            role="button"
            aria-selected={isSelected}
            aria-label={`Select ${label}`}
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

export type { LanguageSelectorProps }
