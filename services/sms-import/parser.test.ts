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
    ["INR 820 paid to Uber Trip via Amex", "Transport", "Credit Card"],
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

  it("parses debit messages that mention card ending details", () => {
    const candidate = parseSmsImportCandidate(
      createMessage("INR 499 spent at Amazon using debit card ending 1234")
    )

    expect(candidate).toEqual(
      expect.objectContaining({
        amount: 499,
        categorySuggestion: "Other",
        paymentMethodSuggestion: { type: "Debit Card" },
      })
    )
  })

  it("ignores credited messages", () => {
    const candidate = parseSmsImportCandidate(
      createMessage("INR 500 credited to your account from employer")
    )

    expect(candidate).toBeNull()
  })

  it.each([
    "OTP 482911 for INR 499 transaction at Amazon. Do not share with anyone.",
    "Your one-time password for UPI txn of Rs. 250 is 834221. Valid for 10 minutes.",
    "Verification code 991822 for credit card purchase of INR 820 at Uber. Never share this code.",
  ])("ignores OTP and authentication messages: %s", (body) => {
    const candidate = parseSmsImportCandidate(createMessage(body))

    expect(candidate).toBeNull()
  })

  it.each([
    "Your available balance is INR 25,430.55 as of 11-04-2026.",
    "Credit card statement generated. Total due INR 8,220. Minimum due INR 410 by 18-04-2026.",
    "Card ending 1234 used for e-commerce token registration. If not you, call bank immediately.",
    "INR 499 transaction at Amazon requires authentication. Approve in app to complete your transaction.",
    "UPI txn of Rs. 250 failed due to incorrect UPI PIN. No amount debited.",
  ])("ignores non-expense bank alerts: %s", (body) => {
    const candidate = parseSmsImportCandidate(createMessage(body))

    expect(candidate).toBeNull()
  })

  it("ignores non-empty messages without a supported amount", () => {
    const candidate = parseSmsImportCandidate(
      createMessage("Your debit card transaction at Swiggy was successful")
    )

    expect(candidate).toBeNull()
  })
})
