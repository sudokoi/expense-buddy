import { useState, useMemo } from "react"
import { Platform, Pressable, Text, View } from "react-native"
import { ChevronDown, ChevronUp, MapPin } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { LanguageSelector } from "../LanguageSelector"
import { CurrencySelector } from "../CurrencySelector"
import { Card } from "../Card"
import { Label } from "../Label"
import { useThemeColors } from "../../../hooks/use-theme-colors"
import {
  UI_OPACITY,
  UI_ICON_SIZE,
  UI_SPACE,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_MIN_TOUCH_TARGET,
} from "../../../constants/ui-tokens"
import { SMS_REGIONS, getSmsRegionLabel } from "../../../utils/region"

interface LocalizationSectionProps {
  languagePreference: string
  onLanguageChange: (lang: string) => void
  defaultCurrency: string
  onCurrencyChange: (currency: string) => void
  smsRegion?: string
  onRegionChange?: (region: string) => void
}

// Map of language codes to labels (matching LanguageSelector)
const languageLabels: Record<string, string> = {
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "en-CA": "English (CA)",
  "en-AU": "English (AU)",
  "en-IN": "English (IN)",
  hi: "Hindi (हिंदी)",
  ja: "Japanese (日本語)",
}

export function LocalizationSection({
  languagePreference,
  onLanguageChange,
  defaultCurrency,
  onCurrencyChange,
  smsRegion,
  onRegionChange,
}: LocalizationSectionProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const [expanded, setExpanded] = useState(false)

  // SMS import is Android-only (ADR-005); region is meaningless elsewhere
  const showRegionControl = Platform.OS === "android" && smsRegion !== undefined

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
        style={({ pressed }) => [{ opacity: pressed ? UI_OPACITY.subtle : 1 }]}
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

          {showRegionControl && (
            <View className="gap-1">
              <Label className="text-xs opacity-80">
                {t("settings.localization.region")}
              </Label>
              <Card className="flex-row flex-wrap rounded-control p-1">
                {SMS_REGIONS.map((region) => {
                  const isSelected = smsRegion === region
                  const label = getSmsRegionLabel(region)
                  return (
                    <Pressable
                      key={region}
                      onPress={() => onRegionChange?.(region)}
                      role="button"
                      aria-selected={isSelected}
                      aria-label={`Select ${label}`}
                      style={({ pressed }) => [
                        { flexBasis: "33%", minHeight: UI_MIN_TOUCH_TARGET },
                        { opacity: pressed ? UI_OPACITY.subtle : 1 },
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
                        <MapPin
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
              <Text className="text-xs text-foreground opacity-50 px-1">
                {t("settings.localization.regionHelp")}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}
