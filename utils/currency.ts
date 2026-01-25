import i18next from "i18next"
import { getLocales } from "expo-localization"

/**
 * Gets the system's default currency code
 * @returns ISO 4217 currency code (e.g. "INR", "USD") or "INR" fallback
 */
export function getSystemCurrency(): string {
  const locales = getLocales()
  if (locales && locales.length > 0) {
    return locales[0].currencyCode ?? "INR"
  }
  return "INR"
}

/**
 * Formats a number as a currency string.
 * @param amount The amount to format.
 * @param currencyCode Optional ISO 4217 currency code. If provided, uses this currency.
 *                     If not provided, falls back to simple logic based on valid locale.
 */
export function formatCurrency(amount: number, currencyCode?: string): string {
  // Legacy expenses (undefined currency) are implicitly INR
  const effectiveCurrency = currencyCode || "INR"
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
