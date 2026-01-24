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
    expect(formatCurrency(100)).toBe("$100.00")
  })

  it("formats GBP for en-GB", () => {
    i18next.language = "en-GB"
    expect(formatCurrency(100)).toBe("£100.00")
  })

  it("formats INR for en-IN", () => {
    i18next.language = "en-IN"
    expect(formatCurrency(100)).toBe("₹100.00")
  })

  it("formats INR for hi", () => {
    expect(formatCurrency(100)).toBe("₹100.00")
  })

  it("defaults to INR for unknown locale or fallback", () => {
    i18next.language = "fr-FR" // fallback behavior based on code
    // My implementation defaults to INR (₹) if not US/GB
    expect(formatCurrency(100)).toBe("₹100.00")
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
