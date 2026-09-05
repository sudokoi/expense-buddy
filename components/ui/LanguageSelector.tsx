import { useTranslation } from "react-i18next"
import { SelectionField } from "./SelectionField"

interface LanguageSelectorProps {
  value: string
  onChange: (lang: string) => void
}

const languages = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-CA", label: "English (CA)" },
  { value: "en-AU", label: "English (AU)" },
  { value: "en-IN", label: "English (IN)" },
  { value: "hi", label: "हिंदी (Hindi)" },
  { value: "ja", label: "日本語 (Japanese)" },
]

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
        ...languages,
      ]}
    />
  )
}

export type { LanguageSelectorProps }
