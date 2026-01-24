import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import { getLocales } from "expo-localization"
import AsyncStorage from "@react-native-async-storage/async-storage"
import "intl-pluralrules"

import enUS from "./locales/en-US/translation.json"
import enGB from "./locales/en-GB/translation.json"
import enIN from "./locales/en-IN/translation.json"
import hi from "./locales/hi/translation.json"
import ja from "./locales/ja/translation.json"

const LANGUAGE_KEY = "user-language"

const resources = {
  "en-US": { translation: enUS },
  "en-GB": { translation: enGB },
  "en-IN": { translation: enIN },
  hi: { translation: hi },
  ja: { translation: ja },
}

const initI18n = async () => {
  let savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY)

  if (!savedLanguage || savedLanguage === "system") {
    const locales = getLocales()
    // Fallback to en-IN if system locale is not supported or undefined
    savedLanguage = locales[0]?.languageTag || "en-IN"
  }

  await i18next.use(initReactI18next).init({
    resources,
    lng: savedLanguage,
    fallbackLng: "en-IN", // Fallback to EN-IN as requested
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: "v4",
  })
}

/**
 * Change the active i18next language.
 * Note: Persistence is handled by the settings store (settings.language field).
 * This function only updates the i18next instance.
 */
export const changeLanguage = async (lang: string) => {
  if (lang === "system") {
    const locales = getLocales()
    const systemLang = locales[0]?.languageTag || "en-IN"
    await i18next.changeLanguage(systemLang)
  } else {
    await i18next.changeLanguage(lang)
  }
}

// Export initialization promise so we can wait for it if needed, or just fire and forget in _layout
export const i18nInit = initI18n()

export default i18next
