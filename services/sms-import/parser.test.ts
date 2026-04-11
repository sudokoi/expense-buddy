import { parseSmsImportCandidate } from "./parser"
import type { SmsImportRawMessage } from "../../types/sms-import"

function createMessage(body: string): SmsImportRawMessage {
  return {
    messageId: "msg-1",
    sender: "VK-HDFCBK",
    body,
    receivedAt: "2026-04-11T10:15:30.000Z",
  }
}

describe("parseSmsImportCandidate", () => {
  it("parses a debit UPI transaction with merchant and amount", () => {
    const candidate = parseSmsImportCandidate(
      createMessage("Rs. 250.50 debited via UPI to Swiggy on 11-04-2026")
    )

    expect(candidate).toEqual({
      amount: 250.5,
      currency: "INR",
      merchantName: "Swiggy on 11-04-2026",
      categorySuggestion: "Food",
      paymentMethodSuggestion: { type: "UPI" },
      noteSuggestion: "SMS import: Swiggy on 11-04-2026",
      transactionDate: "2026-04-11T10:15:30.000Z",
      matchedLocale: "en-IN",
      matchedPatternKey: "india.generic.transaction",
    })
  })

  it.each([
    ["INR 499 spent at Amazon Marketplace using debit card", "Other", "Debit Card"],
    ["INR 820 paid to Uber Trip via credit card", "Transport", "Credit Card"],
    ["INR 1499 paid for Jio recharge", "Utilities", undefined],
    ["INR 899 spent at Apollo Pharmacy", "Health", undefined],
    ["INR 550 spent at BigBasket", "Groceries", undefined],
  ])(
    "infers category and payment method for %s",
    (body, expectedCategory, expectedPaymentMethod) => {
      const candidate = parseSmsImportCandidate(createMessage(body))

      expect(candidate?.categorySuggestion).toBe(expectedCategory)

      if (expectedPaymentMethod) {
        expect(candidate?.paymentMethodSuggestion).toEqual({
          type: expectedPaymentMethod,
        })
      } else {
        expect(candidate?.paymentMethodSuggestion).toBeUndefined()
      }
    }
  )

  it("falls back to Other when no default category pattern matches", () => {
    const candidate = parseSmsImportCandidate(
      createMessage("INR 299 paid to Amazon Marketplace via UPI")
    )

    expect(candidate?.categorySuggestion).toBe("Other")
  })

  it("ignores credited messages", () => {
    const candidate = parseSmsImportCandidate(
      createMessage("INR 500 credited to your account from employer")
    )

    expect(candidate).toBeNull()
  })

  it("ignores non-empty messages without a supported amount", () => {
    const candidate = parseSmsImportCandidate(
      createMessage("Your debit card transaction at Swiggy was successful")
    )

    expect(candidate).toBeNull()
  })
})
