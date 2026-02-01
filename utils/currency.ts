import i18next from "i18next"
import { getLocales } from "expo-localization"

const DEFAULT_CURRENCY = "INR"

const SUPPORTED_CURRENCIES = new Set(["INR", "USD", "GBP", "EUR", "JPY"])

const LANGUAGE_CURRENCY_MAP: Record<string, string> = {
  "en-US": "USD",
  "en-GB": "GBP",
  "en-IN": "INR",
  hi: "INR",
  ja: "JPY",
}

/**
 * Gets the static fallback currency code for legacy expenses.
 * Currently hardcoded to "INR" but can be extended for migration logic.
 */
export function getFallbackCurrency(): string {
  return DEFAULT_CURRENCY
}

/**
 * Gets the system's default currency code
 * @returns ISO 4217 currency code (e.g. "INR", "USD") or "INR" fallback
 */
export function getSystemCurrency(): string {
  const locales = getLocales()
  if (locales && locales.length > 0) {
    return locales[0].currencyCode ?? DEFAULT_CURRENCY
  }
  return DEFAULT_CURRENCY
}

/**
 * Gets the system currency only if it is supported.
 * Falls back to INR if the system currency is unsupported or missing.
 */
export function getSupportedSystemCurrency(): string {
  const locales = getLocales()
  const currency = locales?.[0]?.currencyCode
  if (currency && SUPPORTED_CURRENCIES.has(currency)) {
    return currency
  }
  return DEFAULT_CURRENCY
}

/**
 * Gets the default currency for a given language preference.
 * Uses system currency for "system" and falls back to INR when unsupported.
 */
export function getDefaultCurrencyForLanguage(language: string): string {
  if (language === "system") {
    return getSupportedSystemCurrency()
  }

  return LANGUAGE_CURRENCY_MAP[language] ?? DEFAULT_CURRENCY
}

/**
 * Formats a number as a currency string.
 * @param amount The amount to format.
 * @param currencyCode Optional ISO 4217 currency code. If provided, uses this currency.
 *                     If not provided, falls back to simple logic based on valid locale.
 */
export function formatCurrency(amount: number, currencyCode?: string): string {
  // Legacy expenses (undefined currency) are implicitly INR
  const effectiveCurrency = currencyCode || DEFAULT_CURRENCY
  const language = i18next.language || "en-IN"

  try {
    return new Intl.NumberFormat(language, {
      style: "currency",
      currency: effectiveCurrency,
    }).format(amount)
  } catch (error) {
    // Fallback if Intl fails
    console.warn(`Failed to format currency ${effectiveCurrency}:`, error)

    // Use the symbol from the current locale's translation file
    // This respects the user's language choice for the fallback display
    const symbol = i18next.t("currency.symbol")
    return `${symbol}${amount.toFixed(2)}`
  }
}

/**
 * Gets the currency symbol for a given currency code.
 * @param currencyCode ISO 4217 currency code.
 * @returns The currency symbol (e.g., "₹", "$") or the code itself if symbol not found.
 */
export function getCurrencySymbol(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).formatToParts(0)
    const symbolPart = parts.find((part) => part.type === "currency")
    return symbolPart ? symbolPart.value : currencyCode
  } catch {
    return currencyCode
  }
}

/**
 * Computes the effective currency based on user selection and available data.
 * Priority order:
 * 1. User's selected currency (if available in expenses)
 * 2. Only available currency (if exactly one)
 * 3. Settings default currency (if available in expenses)
 * 4. First available currency, or settings default as final fallback
 *
 * @param selectedCurrency - User's explicit currency selection (null = auto)
 * @param availableCurrencies - Array of available currency codes from expenses
 * @param expensesByCurrency - Map of currency code to expenses
 * @param settingsDefaultCurrency - Default currency from settings
 * @returns The effective currency code to use
 */
export function computeEffectiveCurrency(
  selectedCurrency: string | null,
  availableCurrencies: string[],
  expensesByCurrency: Map<string, unknown>,
  settingsDefaultCurrency: string
): string {
  // If user explicitly selected a currency and it's available, use it
  if (selectedCurrency && expensesByCurrency.has(selectedCurrency)) {
    return selectedCurrency
  }

  // If only one currency is available, use it (auto-select)
  if (availableCurrencies.length === 1) {
    return availableCurrencies[0]
  }

  // Default to settings default currency if available in the data
  if (expensesByCurrency.has(settingsDefaultCurrency)) {
    return settingsDefaultCurrency
  }

  // Fallback to the first available currency, or default if no data
  return availableCurrencies[0] || settingsDefaultCurrency
}
