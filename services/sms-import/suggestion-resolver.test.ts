import type { Category } from "../../types/category"
import type { PaymentInstrument } from "../../types/payment-instrument"
import type { SmsImportReviewItem } from "../../types/sms-import"
import {
  resolveSmsImportCategory,
  resolveSmsImportPaymentSuggestion,
} from "./suggestion-resolver"

function createCategory(label: string, order: number): Category {
  return {
    label,
    icon: "Circle",
    color: "#cccccc",
    order,
    isDefault: false,
    updatedAt: "2026-04-11T10:00:00.000Z",
  }
}

function createInstrument(overrides: Partial<PaymentInstrument> = {}): PaymentInstrument {
  return {
    id: "inst-1",
    method: "Debit Card",
    nickname: "HDFC Debit",
    lastDigits: "4321",
    createdAt: "2026-04-11T10:00:00.000Z",
    updatedAt: "2026-04-11T10:00:00.000Z",
    ...overrides,
  }
}

function createItem(overrides: Partial<SmsImportReviewItem> = {}): SmsImportReviewItem {
  return {
    id: "item-1",
    fingerprint: "fingerprint-1",
    sourceMessage: {
      messageId: "sms-1",
      sender: "VK-HDFCBK",
      body: "INR 250 spent at cafe using debit card 4321",
      receivedAt: "2026-04-11T10:15:30.000Z",
    },
    amount: 250,
    currency: "INR",
    merchantName: "Corner Cafe",
    categorySuggestion: "Food",
    paymentMethodSuggestion: { type: "Debit Card" },
    noteSuggestion: "SMS import: Corner Cafe",
    transactionDate: "2026-04-11T10:15:30.000Z",
    matchedLocale: "en-IN",
    matchedPatternKey: "india.generic.transaction",
    status: "pending",
    createdAt: "2026-04-11T10:16:00.000Z",
    updatedAt: "2026-04-11T10:16:00.000Z",
    ...overrides,
  }
}

describe("resolveSmsImportCategory", () => {
  it("uses a semantically matching custom category from the current device list", () => {
    const categories = [createCategory("Dining Out", 0), createCategory("Other", 1)]

    expect(
      resolveSmsImportCategory(createItem({ categorySuggestion: "Food" }), categories)
    ).toBe("Dining Out")
  })

  it("matches custom transport-style categories by keyword", () => {
    const categories = [createCategory("Fuel", 0), createCategory("Other", 1)]
    const item = createItem({
      categorySuggestion: "Transport",
      sourceMessage: {
        messageId: "sms-2",
        sender: "VK-HDFCBK",
        body: "INR 1200 spent on petrol with debit card 4321",
        receivedAt: "2026-04-11T10:15:30.000Z",
      },
    })

    expect(resolveSmsImportCategory(item, categories)).toBe("Fuel")
  })

  it("falls back to Other when no current category matches", () => {
    const categories = [createCategory("Bills", 0), createCategory("Other", 1)]

    expect(
      resolveSmsImportCategory(createItem({ categorySuggestion: "Food" }), categories)
    ).toBe("Other")
  })
})

describe("resolveSmsImportPaymentSuggestion", () => {
  it("matches a saved card instrument from the current device settings", () => {
    expect(resolveSmsImportPaymentSuggestion(createItem(), [createInstrument()])).toEqual(
      {
        type: "Debit Card",
        identifier: "4321",
        instrumentId: "inst-1",
      }
    )
  })

  it("matches a saved UPI instrument by account digits", () => {
    const item = createItem({
      sourceMessage: {
        messageId: "sms-3",
        sender: "VK-HDFCBK",
        body: "INR 499 debited via UPI from a/c XX321 at Grocery Store",
        receivedAt: "2026-04-11T10:15:30.000Z",
      },
      paymentMethodSuggestion: { type: "UPI" },
    })

    expect(
      resolveSmsImportPaymentSuggestion(item, [
        createInstrument({
          id: "inst-upi",
          method: "UPI",
          nickname: "Salary Account",
          lastDigits: "321",
        }),
      ])
    ).toEqual({
      type: "UPI",
      identifier: "321",
      instrumentId: "inst-upi",
    })
  })

  it("matches a uniquely named saved card when the SMS references Amex", () => {
    const item = createItem({
      sourceMessage: {
        messageId: "sms-4",
        sender: "AX-AMEX",
        body: "INR 499 spent at Airline Portal via Amex",
        receivedAt: "2026-04-11T10:15:30.000Z",
      },
      paymentMethodSuggestion: undefined,
    })

    expect(
      resolveSmsImportPaymentSuggestion(item, [
        createInstrument({
          id: "inst-amex",
          method: "Credit Card",
          nickname: "Amex",
          lastDigits: "9876",
        }),
      ])
    ).toEqual({
      type: "Credit Card",
      identifier: "9876",
      instrumentId: "inst-amex",
    })
  })

  it.each([
    ["Visa", "Credit Card"],
    ["Mastercard", "Credit Card"],
    ["RuPay", "Debit Card"],
    ["Maestro", "Debit Card"],
  ])(
    "matches a uniquely named saved card when the SMS references %s",
    (nickname, method) => {
      const item = createItem({
        sourceMessage: {
          messageId: `sms-${nickname.toLowerCase()}`,
          sender: "VK-BANK",
          body: `INR 499 spent at Merchant Portal via ${nickname}`,
          receivedAt: "2026-04-11T10:15:30.000Z",
        },
        paymentMethodSuggestion: undefined,
      })

      expect(
        resolveSmsImportPaymentSuggestion(item, [
          createInstrument({
            id: `inst-${nickname.toLowerCase()}`,
            method: method as "Credit Card" | "Debit Card",
            nickname,
            lastDigits: "9876",
          }),
        ])
      ).toEqual({
        type: method,
        identifier: "9876",
        instrumentId: `inst-${nickname.toLowerCase()}`,
      })
    }
  )

  it("keeps the inferred payment method when no instrument can be resolved", () => {
    expect(resolveSmsImportPaymentSuggestion(createItem(), [])).toEqual({
      type: "Debit Card",
      identifier: "4321",
    })
  })
})
