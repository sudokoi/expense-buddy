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
  it("prefers merchant evidence over another category word in the description", () => {
    const item = createItem({
      categorySuggestion: "Other",
      merchantName: "APOLLO PHARMACY",
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 250 spent at APOLLO PHARMACY opposite a cafe.",
      },
    })
    expect(
      resolveSmsImportCategory(item, [
        createCategory("Food", 0),
        createCategory("Health Care", 1),
        createCategory("Other", 2),
      ])
    ).toBe("Health Care")
  })
  it("keeps a useful configured guess when native category is Other", () => {
    const item = createItem({
      categorySuggestion: "Other",
      merchantName: undefined,
      noteSuggestion: undefined,
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 250 paid for Work Meals using debit card 4321.",
      },
    })
    expect(
      resolveSmsImportCategory(item, [
        createCategory("Work Meals", 0),
        createCategory("Other", 1),
      ])
    ).toBe("Work Meals")
  })

  it("does not assign a category from an unrelated support instruction", () => {
    const item = createItem({
      categorySuggestion: undefined,
      merchantName: "UNKNOWN STORE",
      noteSuggestion: undefined,
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 250 spent at UNKNOWN STORE. For assistance contact Travel Support.",
      },
    })
    expect(
      resolveSmsImportCategory(item, [
        createCategory("Travel", 0),
        createCategory("Other", 1),
      ])
    ).toBe("Other")
  })
  it.each([
    ["APOLLO PHARMACY", "Health Care", "Please contact your bank."],
    ["CHOCOLATE WORLD", "Other", ""],
  ])(
    "does not infer a category from a substring or footer for %s",
    (merchant, expected, footer) => {
      const item = createItem({
        categorySuggestion: undefined,
        merchantName: merchant,
        noteSuggestion: undefined,
        sourceMessage: {
          ...createItem().sourceMessage,
          body: `INR 250 spent at ${merchant}. ${footer}`,
        },
      })
      expect(
        resolveSmsImportCategory(
          item,
          ["Rent", "Transport", "Health Care", "Other"].map(createCategory)
        )
      ).toBe(expected)
    }
  )
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
  describe("account labels and method-aware nickname phrases", () => {
    const axis = createInstrument({
      id: "axis-upi",
      method: "UPI",
      nickname: "Axis Bank UPI",
      lastDigits: "708",
    })
    const axisBody =
      "INR 15.00 debited\nA/c no. XX1708\n10-09-26, 19:51:13\n" +
      "UPI/P2M/123456789012/BMTC\nNot you? SMS BLOCKUPI Cust ID to 910000000000\nAxis Bank"

    function upiItem(body: string): SmsImportReviewItem {
      return createItem({
        sourceMessage: { ...createItem().sourceMessage, sender: "AXISBK", body },
        merchantName: undefined,
        paymentMethodSuggestion: { type: "UPI" },
      })
    }

    it.each([undefined, "708"])(
      "matches the Axis report with native identifier %s",
      (identifier) => {
        const item = upiItem(axisBody)
        item.paymentMethodSuggestion = { type: "UPI", identifier }
        expect(resolveSmsImportPaymentSuggestion(item, [axis])).toEqual({
          type: "UPI",
          identifier: "708",
          instrumentId: "axis-upi",
        })
      }
    )

    it.each(["A/c no.", "ACCOUNT NUMBER:", "acct no", "a/c no.:", "A/c no.\n", "A/c\n"])(
      "matches a payer suffix after %s without nickname evidence",
      (label) => {
        expect(
          resolveSmsImportPaymentSuggestion(
            upiItem(`INR 15 debited from ${label} XX1708 via UPI.`),
            [axis]
          )?.instrumentId
        ).toBe(axis.id)
      }
    )

    it.each([
      ["Axis Bank UPI", "INR 15 debited via UPI. Axis Bank"],
      ["UPI Axis Bank", "INR 15 debited via UPI. AXIS-BANK"],
      ["Axis Bank Salary UPI", "INR 15 debited via UPI. Axis Bank"],
      ["First National Bank UPI", "INR 15 debited via UPI. First National Bank"],
      ["Axis Bank UPI", axisBody.replace("A/c no. XX1708\n", "")],
    ])("matches a distinctive phrase in %s", (nickname, body) => {
      expect(
        resolveSmsImportPaymentSuggestion(upiItem(body), [{ ...axis, nickname }])
      ).toEqual({ type: "UPI", identifier: "708", instrumentId: "axis-upi" })
    })

    it("matches a credit-card nickname with separate method evidence", () => {
      const item = createItem({
        merchantName: undefined,
        paymentMethodSuggestion: { type: "Credit Card" },
        sourceMessage: {
          ...createItem().sourceMessage,
          body: "INR 15 spent using credit card. First National Bank",
        },
      })
      expect(
        resolveSmsImportPaymentSuggestion(item, [
          createInstrument({
            method: "Credit Card",
            nickname: "First National Bank Credit Card",
          }),
        ])?.instrumentId
      ).toBe("inst-1")
    })

    it("uses a phrase and payer rail when native method inference is absent", () => {
      const item = upiItem("INR 15 debited via UPI. Axis Bank")
      item.paymentMethodSuggestion = undefined
      expect(resolveSmsImportPaymentSuggestion(item, [axis])).toEqual({
        type: "UPI",
        identifier: "708",
        instrumentId: "axis-upi",
      })
    })

    it("prefers an exact nickname over a partial phrase", () => {
      const item = upiItem("INR 15 debited via UPI. Axis Bank Salary")
      expect(
        resolveSmsImportPaymentSuggestion(item, [
          { ...axis, nickname: "Axis Bank Salary" },
          {
            ...axis,
            id: "savings",
            nickname: "Axis Bank Savings UPI",
            lastDigits: "987",
          },
        ])?.instrumentId
      ).toBe(axis.id)
    })

    it.each([false, true])(
      "leaves same-bank phrase matches ambiguous (reversed=%s)",
      (reversed) => {
        const instruments = [
          { ...axis, nickname: "Axis Bank Salary UPI" },
          {
            ...axis,
            id: "savings",
            nickname: "Axis Bank Savings UPI",
            lastDigits: "987",
          },
        ]
        expect(
          resolveSmsImportPaymentSuggestion(
            upiItem("INR 15 debited via UPI. Axis Bank"),
            reversed ? instruments.reverse() : instruments
          )
        ).toEqual({ type: "UPI" })
      }
    )

    it("uses suffixes before nickname phrases", () => {
      expect(
        resolveSmsImportPaymentSuggestion(upiItem(axisBody), [
          { ...axis, lastDigits: "987" },
          { ...axis, id: "salary", nickname: "Salary Account" },
        ])?.instrumentId
      ).toBe("salary")
    })

    it("does not override conflicting payer digits with the bank phrase", () => {
      expect(
        resolveSmsImportPaymentSuggestion(upiItem(axisBody.replace("XX1708", "XX1987")), [
          axis,
        ])
      ).toEqual({ type: "UPI", identifier: "987" })
    })

    it("does not hide a conflicting body suffix behind the native suggestion", () => {
      const item = upiItem(
        "INR 15 debited from a/c no. XX1708, account number XX1987 via UPI. Axis Bank"
      )
      item.paymentMethodSuggestion = { type: "UPI", identifier: "708" }
      expect(resolveSmsImportPaymentSuggestion(item, [axis])).toEqual(
        item.paymentMethodSuggestion
      )
    })

    it.each([
      "INR 15 paid via UPI. For assistance contact Axis Bank support.",
      "INR 15 paid via UPI. Not you? SMS BLOCKUPI to Axis Bank.",
      "INR 15 paid via UPI to Axis Bank.",
      "INR 15 paid via UPI. Beneficiary:Axis Bank",
      "INR 15 paid via UPI to account no. XX1708 at Axis Bank.",
      "INR 15 paid via UPI at Axis Bank Store.",
      "INR 15 debited via UPI/P2M/123456789012/Axis Bank.",
      "INR 15 paid via UPI. Reference: Axis Bank.",
      "INR 15 debited via UPI. Maxis Bank",
      "INR 15 debited via UPI. Axis National Bank",
    ])("excludes unrelated or partial bank evidence: %s", (body) => {
      expect(resolveSmsImportPaymentSuggestion(upiItem(body), [axis])).toEqual({
        type: "UPI",
      })
    })

    it.each(["Bank Account UPI", "Credit Card", "Savings Account UPI"])(
      "does not select from generic nickname words: %s",
      (nickname) => {
        expect(
          resolveSmsImportPaymentSuggestion(
            upiItem(`INR 15 debited via UPI. ${nickname}`),
            [{ ...axis, nickname }]
          )
        ).toEqual({ type: "UPI" })
      }
    )

    it("requires compatible method evidence and an active instrument", () => {
      const item = upiItem("INR 15 debited. Axis Bank")
      expect(
        resolveSmsImportPaymentSuggestion(
          { ...item, paymentMethodSuggestion: undefined },
          [axis]
        )
      ).toBeUndefined()
      expect(
        resolveSmsImportPaymentSuggestion(item, [{ ...axis, method: "Debit Card" }])
      ).toEqual({ type: "UPI" })
      expect(
        resolveSmsImportPaymentSuggestion(item, [{ ...axis, deletedAt: axis.updatedAt }])
      ).toEqual({ type: "UPI" })
    })
  })

  it("does not treat a card limit as payer suffix evidence", () => {
    const item = createItem({
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 250 spent using debit card. Card limit 4321.",
      },
    })
    expect(resolveSmsImportPaymentSuggestion(item, [createInstrument()])).toEqual({
      type: "Debit Card",
    })
  })

  it("matches explicit network suffix evidence without a nickname match", () => {
    const item = createItem({
      paymentMethodSuggestion: undefined,
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 250 spent at Store using Visa ending 4321.",
      },
    })
    expect(resolveSmsImportPaymentSuggestion(item, [createInstrument()])).toEqual({
      type: "Debit Card",
      identifier: "4321",
      instrumentId: "inst-1",
    })
  })
  it("matches a configured Japanese debit card from payer suffix evidence", () => {
    const item = createItem({
      paymentMethodSuggestion: undefined,
      merchantName: "イオン",
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "デビットカード末尾４３２１ ご利用金額 250円 加盟店：イオン",
      },
    })
    expect(resolveSmsImportPaymentSuggestion(item, [createInstrument()])).toEqual({
      type: "Debit Card",
      identifier: "4321",
      instrumentId: "inst-1",
    })
  })
  it("does not mistake the amount for a saved card suffix", () => {
    const item = createItem({
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 4321 spent at Store using debit card.",
      },
    })
    expect(resolveSmsImportPaymentSuggestion(item, [createInstrument()])).toEqual({
      type: "Debit Card",
    })
  })

  it("does not select an instrument when payer identifiers conflict", () => {
    const item = createItem({
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 250 spent using debit card 4321, card 9876.",
      },
    })
    expect(resolveSmsImportPaymentSuggestion(item, [createInstrument()])).toEqual({
      type: "Debit Card",
    })
  })

  it("does not fall back to a nickname that contradicts explicit payer digits", () => {
    const item = createItem({
      paymentMethodSuggestion: undefined,
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 250 spent using Visa card 9876.",
      },
    })
    expect(
      resolveSmsImportPaymentSuggestion(item, [createInstrument({ nickname: "Visa" })])
    ).toBeUndefined()
  })

  it("keeps unique configured matching for a generic payer card with digits", () => {
    const item = createItem({
      paymentMethodSuggestion: undefined,
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 250 spent using Visa card 4321.",
      },
    })
    expect(resolveSmsImportPaymentSuggestion(item, [createInstrument()])).toEqual({
      type: "Debit Card",
      identifier: "4321",
      instrumentId: "inst-1",
    })
  })
  it("does not infer a saved network instrument from support instructions", () => {
    const item = createItem({
      paymentMethodSuggestion: undefined,
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 250 paid to Alex. For assistance contact Visa support.",
      },
    })
    expect(
      resolveSmsImportPaymentSuggestion(item, [
        createInstrument({ nickname: "Visa", method: "Credit Card" }),
      ])
    ).toBeUndefined()
  })

  it("does not enrich a payer method using recipient digits", () => {
    const item = createItem({
      paymentMethodSuggestion: { type: "UPI" },
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 250 paid via UPI to account XX321.",
      },
    })
    expect(
      resolveSmsImportPaymentSuggestion(item, [
        createInstrument({ method: "UPI", lastDigits: "321" }),
      ])
    ).toEqual({ type: "UPI" })
  })

  it("does not choose the first of two matching saved instruments", () => {
    const item = createItem({
      paymentMethodSuggestion: { type: "Debit Card", identifier: "4321" },
    })
    expect(
      resolveSmsImportPaymentSuggestion(item, [
        createInstrument(),
        createInstrument({ id: "second", nickname: "Another Debit" }),
      ])
    ).toEqual(item.paymentMethodSuggestion)
  })
  it("keeps an explicit bank-transfer rail when a saved card is mentioned as the recipient", () => {
    const item = createItem({
      paymentMethodSuggestion: { type: "Net Banking" },
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 500 paid via NEFT for credit card ending 4321.",
      },
    })
    expect(
      resolveSmsImportPaymentSuggestion(item, [
        createInstrument({ method: "Credit Card" }),
      ])
    ).toEqual({ type: "Net Banking" })
  })
  it("does not match an account debit to a saved debit card", () => {
    const item = createItem({
      paymentMethodSuggestion: undefined,
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 500 debited from a/c XX4321 to Alex.",
      },
    })
    expect(resolveSmsImportPaymentSuggestion(item, [createInstrument()])).toBeUndefined()
  })

  it("does not select a saved credit card over explicit Visa debit wording", () => {
    const item = createItem({
      paymentMethodSuggestion: undefined,
      sourceMessage: {
        ...createItem().sourceMessage,
        body: "INR 500 spent at Store using Visa debit card ending 4321.",
      },
    })
    expect(
      resolveSmsImportPaymentSuggestion(item, [
        createInstrument({ method: "Credit Card" }),
      ])
    ).toBeUndefined()
  })
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
