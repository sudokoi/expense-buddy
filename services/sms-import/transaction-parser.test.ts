/**
 * Transaction Parser Tests
 *
 * Tests for pure functions in the transaction parser
 */

import { TransactionParser } from "./transaction-parser"

describe("TransactionParser", () => {
  const parser = new TransactionParser()

  describe("parse", () => {
    it("should parse HDFC Bank SMS", async () => {
      const sms =
        "Rs.1,500.00 debited from a/c **1234 on 15-02-2026. Avl Bal: Rs.25,430.50. Swiggy - Food Order"
      const result = await parser.parse(sms, "sms")

      expect(result).not.toBeNull()
      expect(result!.amount).toBe(1500)
      expect(result!.merchant).toBe("Swiggy")
      expect(result!.transactionType).toBe("debit")
      expect(result!.currency).toBe("INR")
    })

    it("should parse ICICI Bank SMS", async () => {
      const sms =
        "Thank you for using your ICICI Bank Credit Card ending 5678 for INR 2,499 at AMAZON on 14-02-2026"
      const result = await parser.parse(sms, "sms")

      expect(result).not.toBeNull()
      expect(result!.amount).toBe(2499)
      expect(result!.merchant).toBe("Amazon")
      expect(result!.paymentMethod).toBe("Credit Card")
    })

    it("should parse SBI Bank SMS", async () => {
      const sms = "Rs.500 withdrawn from ATM on 13-02-2026"
      const result = await parser.parse(sms, "sms")

      expect(result).not.toBeNull()
      expect(result!.amount).toBe(500)
    })

    it("should parse Axis Bank SMS", async () => {
      const sms = "INR 1,200 paid to SWIGGY via UPI on 12-02-2026"
      const result = await parser.parse(sms, "sms")

      expect(result).not.toBeNull()
      expect(result!.amount).toBe(1200)
      expect(result!.merchant).toBe("Swiggy")
      expect(result!.paymentMethod).toBe("UPI")
    })

    it("should parse Chase Bank SMS", async () => {
      const sms = "You made a $45.99 transaction at STARBUCKS on 02/15/2026"
      const result = await parser.parse(sms, "sms")

      expect(result).not.toBeNull()
      expect(result!.amount).toBe(45.99)
      expect(result!.merchant).toBe("Starbucks")
      expect(result!.currency).toBe("USD")
    })

    it("should parse Bank of America SMS", async () => {
      const sms = "$120.00 was charged at WHOLE FOODS on 02/15/2026"
      const result = await parser.parse(sms, "sms")

      expect(result).not.toBeNull()
      expect(result!.amount).toBe(120)
      expect(result!.merchant).toBe("Whole Foods")
    })

    it("should parse Revolut SMS", async () => {
      const sms = "€25.00 paid to UBER on 15-02-2026"
      const result = await parser.parse(sms, "sms")

      expect(result).not.toBeNull()
      expect(result!.amount).toBe(25)
      expect(result!.merchant).toBe("Uber")
      expect(result!.currency).toBe("EUR")
    })

    it("should parse MUFG Bank SMS", async () => {
      const sms = "¥3,500 引落 セブンイレブン"
      const result = await parser.parse(sms, "sms")

      expect(result).not.toBeNull()
      expect(result!.amount).toBe(3500)
      expect(result!.currency).toBe("JPY")
    })

    it("should parse PhonePe UPI SMS", async () => {
      const sms = "Rs.350 paid to ZOMATO via PhonePe UPI. UPI Ref: 123456789012"
      const result = await parser.parse(sms, "sms")

      expect(result).not.toBeNull()
      expect(result!.amount).toBe(350)
      expect(result!.merchant).toBe("Zomato")
      expect(result!.paymentMethod).toBe("UPI")
    })

    it("should return null for non-transaction SMS", async () => {
      const sms = "Hello, how are you today? This is just a regular message."
      const result = await parser.parse(sms, "sms")

      expect(result).toBeNull()
    })

    it("should return null for OTP messages", async () => {
      const sms = "Your OTP is 123456. Valid for 10 minutes."
      const result = await parser.parse(sms, "sms")

      expect(result).toBeNull()
    })
  })

  describe("parseAmount", () => {
    it.each([
      ["1500", 1500],
      ["1,500", 1500],
      ["1,500.00", 1500],
      ["1500.50", 1500.5],
      ["₹1,500", 1500],
      ["$45.99", 45.99],
      ["€25.00", 25],
      ["£10.50", 10.5],
      ["¥3,500", 3500],
    ])("should parse '%s' as %s", (input, expected) => {
      // Access private method through any cast for testing
      const result = (parser as any).parseAmount(input)
      expect(result).toBe(expected)
    })

    it.each([[""], ["abc"], ["   "], ["Rs."], ["$"]])(
      "should return null for invalid amount '%s'",
      (input) => {
        const result = (parser as any).parseAmount(input)
        expect(result).toBeNull()
      }
    )
  })

  describe("cleanMerchant", () => {
    it.each([
      ["SWIGGY", "Swiggy"],
      ["AMAZON", "Amazon"],
      ["STARBUCKS", "Starbucks"],
      ["Company PVT LTD", "Company"],
      ["Business Inc.", "Business"],
      ["  Multiple   Spaces  ", "Multiple Spaces"],
    ])("should clean '%s' to '%s'", (input, expected) => {
      const result = (parser as any).cleanMerchant(input)
      expect(result).toBe(expected)
    })
  })

  describe("parseDate", () => {
    it("should parse DD-MM-YYYY format", () => {
      const result = (parser as any).parseDate("15-02-2026")
      expect(result).not.toBeNull()
      expect(new Date(result!).getDate()).toBe(15)
      expect(new Date(result!).getMonth()).toBe(1) // February (0-indexed)
      expect(new Date(result!).getFullYear()).toBe(2026)
    })

    it("should parse YYYY-MM-DD format", () => {
      const result = (parser as any).parseDate("2026-02-15")
      expect(result).not.toBeNull()
      expect(new Date(result!).getDate()).toBe(15)
      expect(new Date(result!).getMonth()).toBe(1)
    })

    it("should parse DD/MM/YYYY format", () => {
      const result = (parser as any).parseDate("15/02/2026")
      expect(result).not.toBeNull()
      expect(new Date(result!).getDate()).toBe(15)
    })

    it("should return null for invalid date", () => {
      const result = (parser as any).parseDate("invalid date")
      expect(result).toBeNull()
    })

    it("should return null for empty string", () => {
      const result = (parser as any).parseDate("")
      expect(result).toBeNull()
    })
  })

  describe("detectTransactionType", () => {
    it.each([
      ["Rs.100 debited", "debit"],
      ["Amount spent at store", "debit"],
      ["Payment made", "debit"],
      ["Cash withdrawn", "debit"],
      ["Purchase completed", "debit"],
      ["Rs.100 credited", "credit"],
      ["Amount received", "credit"],
      ["Refund processed", "credit"],
      ["Cashback earned", "credit"],
    ])("should detect '%s' as %s", (input, expected) => {
      const result = (parser as any).detectTransactionType(input)
      expect(result).toBe(expected)
    })

    it("should default to debit for unknown messages", () => {
      const result = (parser as any).detectTransactionType("Some random message")
      expect(result).toBe("debit")
    })
  })

  describe("inferPaymentMethod", () => {
    it.each([
      ["Payment via UPI", "UPI"],
      ["UPI Ref: 123456", "UPI"],
      ["Credit Card ending 1234", "Credit Card"],
      ["Paid with Credit Card", "Credit Card"],
      ["Debit Card used", "Debit Card"],
      ["DC purchase", "Debit Card"],
      ["Net Banking transaction", "Net Banking"],
      ["Internet Banking", "Net Banking"],
      ["Paid via Paytm", "Amazon Pay"],
      ["Cash payment", "Cash"],
      ["Unknown method", "Other"],
    ])("should infer '%s' as %s", (input, expected) => {
      const result = (parser as any).inferPaymentMethod(input, {})
      expect(result).toBe(expected)
    })
  })

  describe("extractCurrency", () => {
    it.each([
      ["Rs.1000", "INR"],
      ["INR 500", "INR"],
      ["₹200", "INR"],
      ["$100", "USD"],
      ["USD 50", "USD"],
      ["€25", "EUR"],
      ["EUR 100", "EUR"],
      ["£50", "GBP"],
      ["GBP 25", "GBP"],
      ["¥1000", "JPY"],
      ["JPY 500", "JPY"],
      ["Random amount", "INR"], // Default
    ])("should extract currency from '%s' as %s", (input, expected) => {
      const result = (parser as any).extractCurrency(input, {})
      expect(result).toBe(expected)
    })
  })

  describe("generateMessageId", () => {
    it("should generate consistent IDs for same message", () => {
      const message = "Test message for ID generation"
      const id1 = (parser as any).generateMessageId(message)
      const id2 = (parser as any).generateMessageId(message)

      expect(id1).toBe(id2)
    })

    it("should generate different IDs for different messages", () => {
      const id1 = (parser as any).generateMessageId("Message one")
      const id2 = (parser as any).generateMessageId("Message two")

      expect(id1).not.toBe(id2)
    })

    it("should return hexadecimal string", () => {
      const id = (parser as any).generateMessageId("Test")
      expect(id).toMatch(/^[0-9a-f]+$/)
    })
  })
})
