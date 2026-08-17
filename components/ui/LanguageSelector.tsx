import { View, Text } from "react-native"
import { Globe, Languages, type LucideIcon } from "lucide-react-native"
import { Pressable } from "react-native"
import { Card } from "./Card"
import { useTranslation } from "react-i18next"
import {
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"

interface LanguageSelectorProps {
  value: string
  onChange: (lang: string) => void
}

interface LanguageOption {
  key: string
  label: string
  Icon: LucideIcon
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
 */
export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const theme = useThemeColors()
  const { t } = useTranslation()

  const options = languageOptions.map((opt) => ({
    ...opt,
    label: opt.key === "system" ? t("settings.appearance.options.system") : opt.label,
  }))

  return (
    <Card className="flex-row flex-wrap rounded-control p-1">
      {options.map(({ key, label, Icon }) => {
        const isSelected = value === key
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            role="button"
            aria-selected={isSelected}
            aria-label={`Select ${label}`}
            style={({ pressed }) => [
              { flexBasis: "50%", minHeight: 44 },
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <View
              className="flex-row items-center justify-center gap-2 rounded-control p-2"
              style={{
                borderWidth: UI_BORDER_WIDTH.normal,
                backgroundColor: isSelected ? theme.muted : "transparent",
                borderColor: isSelected ? theme.accent : "transparent",
                margin: UI_SPACE.micro / 2,
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

export type { LanguageSelectorProps }
