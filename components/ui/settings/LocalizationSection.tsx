import { useState, useMemo } from "react"
import { Pressable, Text, View } from "react-native"
import { ChevronDown, ChevronUp } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { LanguageSelector } from "../LanguageSelector"
import { CurrencySelector } from "../CurrencySelector"
import { Label } from "../Label"
import { useThemeColors } from "../../../hooks/use-theme-colors"
import { UI_OPACITY, UI_ICON_SIZE } from "../../../constants/ui-tokens"

interface LocalizationSectionProps {
  languagePreference: string
  onLanguageChange: (lang: string) => void
  defaultCurrency: string
  onCurrencyChange: (currency: string) => void
}

// Map of language codes to labels (matching LanguageSelector)
const languageLabels: Record<string, string> = {
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "en-IN": "English (IN)",
  hi: "Hindi (हिंदी)",
  ja: "Japanese (日本語)",
}

export function LocalizationSection({
  languagePreference,
  onLanguageChange,
  defaultCurrency,
  onCurrencyChange,
}: LocalizationSectionProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const [expanded, setExpanded] = useState(false)

  const languageLabel = useMemo(() => {
    if (languagePreference === "system") {
      return t("settings.appearance.options.system")
    }
    return languageLabels[languagePreference] || languagePreference
  }, [languagePreference, t])

  const currencyLabel = useMemo(() => {
    return defaultCurrency || "USD"
  }, [defaultCurrency])

  const summary = `${languageLabel} • ${currencyLabel}`

  return (
    <View className="gap-2">
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        role="button"
        aria-expanded={expanded}
        style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
      >
        <View className="flex-1 bg-surface flex-row items-center justify-between py-2.5 px-3 rounded-chip">
          <View className="flex-1 gap-1">
            <Text className="text-xs text-foreground opacity-50 uppercase">
              {t("settings.sections.localization")}
            </Text>
            <Text className="text-foreground opacity-70 text-[13px]">{summary}</Text>
          </View>
          {expanded ? (
            <ChevronUp
              size={UI_ICON_SIZE.medium}
              color={theme.foreground}
              style={{ opacity: UI_OPACITY.subtle }}
            />
          ) : (
            <ChevronDown
              size={UI_ICON_SIZE.medium}
              color={theme.foreground}
              style={{ opacity: UI_OPACITY.subtle }}
            />
          )}
        </View>
      </Pressable>

      {expanded && (
        <View className="gap-3 mt-1 bg-surface p-3 rounded-card">
          <View className="gap-1">
            <Label className="text-xs opacity-80">
              {t("settings.localization.language")}
            </Label>
            <LanguageSelector value={languagePreference} onChange={onLanguageChange} />
          </View>

          <View className="gap-1">
            <Label className="text-xs opacity-80">
              {t("settings.localization.currency")}
            </Label>
            <CurrencySelector value={defaultCurrency} onChange={onCurrencyChange} />
          </View>
        </View>
      )}
    </View>
  )
}
