import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import { getLocales } from "expo-localization"
import "intl-pluralrules"

// Static fallback locale - always bundled
import enIN from "./locales/en-IN/translation.json"

// Supported locales for dynamic loading
const SUPPORTED_LOCALES = ["en-US", "en-GB", "en-IN", "hi", "ja"] as const
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

/**
 * Dynamically load a locale's translations
 * @param lang - The locale code to load
 * @returns The translation object
 */
const loadLocaleTranslations = async (lang: SupportedLocale) => {
  switch (lang) {
    case "en-US":
      return (await import("./locales/en-US/translation.json")).default
    case "en-GB":
      return (await import("./locales/en-GB/translation.json")).default
    case "en-IN":
      return enIN // Already loaded statically
    case "hi":
      return (await import("./locales/hi/translation.json")).default
    case "ja":
      return (await import("./locales/ja/translation.json")).default
    default:
      throw new Error(`Unsupported locale: ${lang}`)
  }
}

/**
 * Check if a locale is already loaded
 */
const isLocaleLoaded = (lang: string): boolean => {
  return i18next.hasResourceBundle(lang, "translation")
}

/**
 * Load a locale dynamically and activate it
 * @param lang - The locale code (or "system" for system default)
 * @returns Promise that resolves when locale is loaded and activated
 */
export const loadLocale = async (lang: string): Promise<void> => {
  // Handle "system" option
  let targetLang: SupportedLocale
  if (lang === "system") {
    const systemLang = getLocales()[0]?.languageTag || "en-IN"
    // Check if system language is supported, fallback to en-IN
    targetLang = SUPPORTED_LOCALES.includes(systemLang as SupportedLocale)
      ? (systemLang as SupportedLocale)
      : "en-IN"
  } else {
    targetLang = lang as SupportedLocale
  }

  // If locale is already loaded, just change language
  if (isLocaleLoaded(targetLang)) {
    await i18next.changeLanguage(targetLang)
    return
  }

  // Load locale dynamically
  try {
    const translations = await loadLocaleTranslations(targetLang)
    i18next.addResourceBundle(targetLang, "translation", translations)
    await i18next.changeLanguage(targetLang)
  } catch (error) {
    console.warn(`Failed to load locale ${targetLang}, using fallback`, error)
    // Ensure we fallback to en-IN which is always available
    if (targetLang !== "en-IN") {
      await i18next.changeLanguage("en-IN")
    }
  }
}

/**
 * Initialize i18next with minimal static resources.
 * Loads system language dynamically if different from en-IN.
 */
const initI18n = async () => {
  const locales = getLocales()
  const systemLang = locales[0]?.languageTag || "en-IN"
  const initialLang = SUPPORTED_LOCALES.includes(systemLang as SupportedLocale)
    ? systemLang
    : "en-IN"

  // Initialize with only static fallback
  await i18next.use(initReactI18next).init({
    resources: {
      "en-IN": { translation: enIN },
    },
    lng: "en-IN", // Start with fallback, then load preferred
    fallbackLng: "en-IN",
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: "v4",
  })

  // Load system language if different from fallback
  if (initialLang !== "en-IN") {
    await loadLocale(initialLang)
  }
}

/**
 * Change the active i18next language.
 * Loads locale dynamically if not already loaded.
 * Note: Persistence is handled by the settings store.
 */
export const changeLanguage = async (lang: string): Promise<void> => {
  await loadLocale(lang)
}

// Export initialization promise
export const i18nInit = initI18n()

export default i18next
