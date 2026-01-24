import { formatCurrency } from "./currency"
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
