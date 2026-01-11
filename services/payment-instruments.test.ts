import {
  createMigrationNickname,
  formatMaskedLastDigits,
  formatPaymentInstrumentLabel,
  getLastDigitsLength,
  sanitizeLastDigits,
  validatePaymentInstrumentInput,
} from "./payment-instruments"
import type { PaymentInstrument } from "../types/payment-instrument"

describe("payment-instruments", () => {
  test("getLastDigitsLength", () => {
    expect(getLastDigitsLength("UPI")).toBe(3)
    expect(getLastDigitsLength("Credit Card")).toBe(4)
    expect(getLastDigitsLength("Debit Card")).toBe(4)
  })

  test("sanitizeLastDigits strips non-digits and clamps length", () => {
    expect(sanitizeLastDigits("a1b2c3d4", 4)).toBe("1234")
    expect(sanitizeLastDigits("12-34-56", 4)).toBe("1234")
    expect(sanitizeLastDigits("999999", 3)).toBe("999")
  })

  test("formatMaskedLastDigits masks cards but not UPI", () => {
    expect(formatMaskedLastDigits("Credit Card", "1234")).toBe("****1234")
    expect(formatMaskedLastDigits("Debit Card", "0000")).toBe("****0000")
    expect(formatMaskedLastDigits("UPI", "123")).toBe("123")
  })

  test("formatPaymentInstrumentLabel", () => {
    const inst: PaymentInstrument = {
      id: "i1",
      method: "Credit Card",
      nickname: "HDFC Visa",
      lastDigits: "1234",
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    }

    expect(formatPaymentInstrumentLabel(inst)).toBe("HDFC Visa • ****1234")
  })

  describe("validatePaymentInstrumentInput", () => {
    test("requires nickname", () => {
      const result = validatePaymentInstrumentInput(
        { method: "UPI", nickname: " ", lastDigits: "123" },
        []
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.nickname).toBeDefined()
      }
    })

    test("requires exact digits length", () => {
      const result = validatePaymentInstrumentInput(
        { method: "Credit Card", nickname: "Card", lastDigits: "123" },
        []
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.lastDigits).toContain("exactly")
      }
    })

    test("prevents duplicate nickname per method (case/space insensitive)", () => {
      const existing: PaymentInstrument[] = [
        {
          id: "i1",
          method: "UPI",
          nickname: "My   UPI",
          lastDigits: "123",
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ]

      const result = validatePaymentInstrumentInput(
        { method: "UPI", nickname: "  my upi ", lastDigits: "456" },
        existing
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.nickname).toBeDefined()
      }

      // Same nickname is allowed for a different method
      const okDifferentMethod = validatePaymentInstrumentInput(
        { method: "Credit Card", nickname: "  my upi ", lastDigits: "1234" },
        existing
      )
      expect(okDifferentMethod.success).toBe(true)
    })

    test("ignores deleted instruments for duplicate check", () => {
      const existing: PaymentInstrument[] = [
        {
          id: "i1",
          method: "UPI",
          nickname: "My UPI",
          lastDigits: "123",
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z",
          deletedAt: "2020-01-02T00:00:00.000Z",
        },
      ]

      const result = validatePaymentInstrumentInput(
        { method: "UPI", nickname: "my upi", lastDigits: "456" },
        existing
      )
      expect(result.success).toBe(true)
    })

    test("allows same nickname when editing same instrument", () => {
      const existing: PaymentInstrument[] = [
        {
          id: "i1",
          method: "Debit Card",
          nickname: "Axis",
          lastDigits: "1111",
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ]

      const result = validatePaymentInstrumentInput(
        { method: "Debit Card", nickname: "axis", lastDigits: "2222" },
        existing,
        "i1"
      )

      expect(result.success).toBe(true)
    })
  })

  describe("createMigrationNickname", () => {
    test("uses method-specific base label", () => {
      expect(createMigrationNickname("UPI", "123", [])).toBe("UPI 123")
      expect(createMigrationNickname("Credit Card", "1234", [])).toBe(
        "Credit 1234"
      )
      expect(createMigrationNickname("Debit Card", "1234", [])).toBe("Debit 1234")
    })

    test("adds suffix when nickname already exists (ignores deleted)", () => {
      const existing: PaymentInstrument[] = [
        {
          id: "i1",
          method: "Credit Card",
          nickname: "Credit 1234",
          lastDigits: "1234",
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
        {
          id: "i2",
          method: "Credit Card",
          nickname: "Credit 1234 (2)",
          lastDigits: "1234",
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z",
          deletedAt: "2020-01-02T00:00:00.000Z",
        },
      ]

      // (2) is deleted, so it can reuse it? createMigrationNickname currently checks
      // normalized nickname set excluding deleted, so (2) should be available.
      expect(createMigrationNickname("Credit Card", "1234", existing)).toBe(
        "Credit 1234 (2)"
      )
    })
  })
})
