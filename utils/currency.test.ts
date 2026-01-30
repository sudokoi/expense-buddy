import { formatCurrency, computeEffectiveCurrency } from "./currency"
import i18next from "i18next"

// Mock i18next
jest.mock("i18next", () => ({
  language: "en-US",
  changeLanguage: jest.fn(),
}))

describe("formatCurrency", () => {
  it("formats USD for en-US", () => {
    i18next.language = "en-US"
    expect(formatCurrency(100, "USD")).toBe("$100.00")
  })

  it("formats GBP for en-GB", () => {
    i18next.language = "en-GB"
    expect(formatCurrency(100, "GBP")).toBe("£100.00")
  })

  it("formats INR for en-IN", () => {
    i18next.language = "en-IN"
    expect(formatCurrency(100, "INR")).toMatch(/^[₹Rs]\s?100\.00$/)
  })

  it("formats INR for hi", () => {
    expect(formatCurrency(100)).toBe("₹100.00")
  })

  it("defaults to INR for unknown locale or fallback", () => {
    i18next.language = "fr-FR" // fallback behavior based on code
    // My implementation defaults to INR (₹) if not US/GB
    // French uses comma for decimal and suffix symbol, e.g. "100,00 ₹"
    const result = formatCurrency(100)
    expect(result).toContain("100")
    expect(result).toMatch(/₹|INR/)
  })

  it("formats using provided currency code regardless of locale", () => {
    i18next.language = "en-US"
    // Should use EUR symbol even if locale is US
    const eur = formatCurrency(100, "EUR")
    // Intl.NumberFormat(en-US, {currency: EUR}) -> €100.00
    expect(eur).toContain("€")
    expect(eur).toContain("100.00")

    const jpy = formatCurrency(100, "JPY")
    // JPY usually has no decimals or different depending on locale settings, but standard JPY has 0 fraction digits by default?
    // Actually default display for JPY in en-US might be "¥100"
    expect(jpy).toContain("¥")
  })
})

describe("computeEffectiveCurrency", () => {
  const createExpensesMap = (currencies: string[]): Map<string, unknown[]> => {
    const map = new Map<string, unknown[]>()
    currencies.forEach((currency) => {
      map.set(currency, [{ currency }])
    })
    return map
  }

  it("should use selected currency when available", () => {
    const expensesByCurrency = createExpensesMap(["USD", "INR"])
    const result = computeEffectiveCurrency(
      "USD",
      ["INR", "USD"],
      expensesByCurrency,
      "INR"
    )
    expect(result).toBe("USD")
  })

  it("should fallback to settings default when selected not available", () => {
    const expensesByCurrency = createExpensesMap(["USD", "INR"])
    const result = computeEffectiveCurrency(
      "EUR", // Not available
      ["INR", "USD"],
      expensesByCurrency,
      "USD" // Settings default
    )
    expect(result).toBe("USD")
  })

  it("should auto-select when only one currency available", () => {
    const expensesByCurrency = createExpensesMap(["USD"])
    const result = computeEffectiveCurrency(
      null, // No selection
      ["USD"],
      expensesByCurrency,
      "INR" // Settings default different from available
    )
    expect(result).toBe("USD")
  })

  it("should use settings default when multiple currencies and no selection", () => {
    const expensesByCurrency = createExpensesMap(["USD", "INR", "EUR"])
    const result = computeEffectiveCurrency(
      null,
      ["EUR", "INR", "USD"],
      expensesByCurrency,
      "EUR"
    )
    expect(result).toBe("EUR")
  })

  it("should fallback to first available when settings default not in data", () => {
    const expensesByCurrency = createExpensesMap(["USD", "INR"])
    const result = computeEffectiveCurrency(
      null,
      ["INR", "USD"],
      expensesByCurrency,
      "EUR" // Not in expenses
    )
    expect(result).toBe("INR") // First available
  })

  it("should fallback to settings default when no expenses", () => {
    const expensesByCurrency = new Map<string, unknown[]>()
    const result = computeEffectiveCurrency(null, [], expensesByCurrency, "USD")
    expect(result).toBe("USD")
  })

  it("should handle selected currency deletion gracefully", () => {
    // User had selected USD, but all USD expenses deleted
    const expensesByCurrency = createExpensesMap(["INR"])
    const result = computeEffectiveCurrency(
      "USD", // Selected but no longer available
      ["INR"],
      expensesByCurrency,
      "INR"
    )
    // Should fallback to only available currency
    expect(result).toBe("INR")
  })

  it("should prioritize selected over single available", () => {
    // Edge case: only one currency but user selected a different one
    const expensesByCurrency = createExpensesMap(["USD"])
    const result = computeEffectiveCurrency("USD", ["USD"], expensesByCurrency, "INR")
    expect(result).toBe("USD")
  })
})
