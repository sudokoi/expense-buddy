import { Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { LanguageSelector } from "../LanguageSelector"
import { CurrencySelector } from "../CurrencySelector"
import { SelectionField } from "../SelectionField"
import { SMS_REGIONS } from "../../../utils/region"

interface LocalizationSectionProps {
  languagePreference: string
  onLanguageChange: (lang: string) => void
  defaultCurrency: string
  onCurrencyChange: (currency: string) => void
  smsRegion?: string
  onRegionChange?: (region: string) => void
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
  return (
    <View className="gap-3">
      <LanguageSelector value={languagePreference} onChange={onLanguageChange} />
      <CurrencySelector value={defaultCurrency} onChange={onCurrencyChange} />
      {smsRegion !== undefined && onRegionChange ? (
        <>
          <SelectionField
            layout="inline"
            label={t("settings.localization.region")}
            description={t("settings.localization.regionHelp")}
            value={smsRegion}
            onChange={onRegionChange}
            options={SMS_REGIONS.map((region) => ({
              value: region,
              label: t(`settings.localization.regionNames.${region}`),
            }))}
          />
          <Text className="text-xs text-muted-foreground">
            {t("settings.localization.regionHelp")}
          </Text>
        </>
      ) : null}
    </View>
  )
}
