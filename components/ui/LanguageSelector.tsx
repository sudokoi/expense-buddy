import { useTranslation } from "react-i18next"
import { SelectionField } from "./SelectionField"

interface LanguageSelectorProps {
  value: string
  onChange: (lang: string) => void
}

// Autonyms stay recognizable even when the user cannot read the current language.
const languages = ["en-US", "en-GB", "en-CA", "en-AU", "en-IN", "hi", "ja"] as const

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const { t } = useTranslation()
  return (
    <SelectionField
      layout="inline"
      label={t("settings.localization.language")}
      description={t("settings.localization.languageChangeMessage")}
      value={value}
      onChange={onChange}
      options={[
        { value: "system", label: t("settings.appearance.options.system") },
        ...languages.map((language) => ({
          value: language,
          label: t(`ui.languages.${language}`),
        })),
      ]}
    />
  )
}

export type { LanguageSelectorProps }
