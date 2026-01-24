import { useState, useMemo } from "react"
import { YStack, XStack, Text, Label } from "tamagui"
import { ViewStyle, Pressable } from "react-native"
import { ChevronDown, ChevronUp } from "@tamagui/lucide-icons"
import { useTranslation } from "react-i18next"
import { LanguageSelector } from "../LanguageSelector"
import { CurrencySelector } from "../CurrencySelector"

interface LocalizationSectionProps {
  languagePreference: string
  onLanguageChange: (lang: string) => void
  defaultCurrency: string
  onCurrencyChange: (currency: string) => void
}

const layoutStyles = {
  collapsibleHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  } as ViewStyle,
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
    <YStack gap="$2">
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
      >
        <XStack flex={1} style={layoutStyles.collapsibleHeader}>
          <Text color="$color" opacity={0.6} fontSize="$3">
            {summary}
          </Text>
          {expanded ? (
            <ChevronUp size={20} color="$color" opacity={0.6} />
          ) : (
            <ChevronDown size={20} color="$color" opacity={0.6} />
          )}
        </XStack>
      </Pressable>

      {expanded && (
        <YStack gap="$4" mt="$2">
          <YStack gap="$2">
            <Label color="$color" opacity={0.8} fontSize="$2">
              {t("settings.localization.language")}
            </Label>
            <LanguageSelector value={languagePreference} onChange={onLanguageChange} />
          </YStack>

          <YStack gap="$2">
            <Label color="$color" opacity={0.8} fontSize="$2">
              {t("settings.localization.currency")}
            </Label>
            <CurrencySelector value={defaultCurrency} onChange={onCurrencyChange} />
          </YStack>
        </YStack>
      )}
    </YStack>
  )
}
