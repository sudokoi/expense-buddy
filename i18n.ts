import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import { getLocales } from "expo-localization"
import AsyncStorage from "@react-native-async-storage/async-storage"
import "intl-pluralrules"

import enUS from "./locales/en-US/translation.json"
import enGB from "./locales/en-GB/translation.json"
import enIN from "./locales/en-IN/translation.json"
import hi from "./locales/hi/translation.json"

const LANGUAGE_KEY = "user-language"

const resources = {
  "en-US": { translation: enUS },
  "en-GB": { translation: enGB },
  "en-IN": { translation: enIN },
  hi: { translation: hi },
}

const initI18n = async () => {
  let savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY)

  if (!savedLanguage) {
    const locales = getLocales()
    savedLanguage = locales[0]?.languageTag || "en-US"
  }

  await i18next.use(initReactI18next).init({
    resources,
    lng: savedLanguage,
    fallbackLng: "en-US",
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: "v4", // For Android compatibility with minimal json support if needed
  })
}

export const changeLanguage = async (lang: string) => {
  await i18next.changeLanguage(lang)
  await AsyncStorage.setItem(LANGUAGE_KEY, lang)
}

// Export initialization promise so we can wait for it if needed, or just fire and forget in _layout
export const i18nInit = initI18n()

export default i18next
