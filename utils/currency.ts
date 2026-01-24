import i18next from "i18next"

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
