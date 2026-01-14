/**
 * Property-based tests for Payment Method Display utility
 *
 * Feature: payment-settings-improvements, Property 1: Payment method display formatting
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import fc from "fast-check"
import { formatPaymentMethodDisplay } from "./payment-method-display"
import { PaymentMethod, PaymentMethodType } from "../types/expense"

// Arbitrary generators for payment method types
const paymentMethodTypeArb = fc.constantFrom<PaymentMethodType>(
  "Cash",
  "Amazon Pay",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other"
)

// Generator for valid identifiers (numeric strings of 1-4 digits)
const identifierArb = fc
  .array(fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"), {
    minLength: 1,
    maxLength: 4,
  })
  .map((chars) => chars.join(""))

// Generator for payment method with identifier
const paymentMethodWithIdentifierArb: fc.Arbitrary<PaymentMethod> = fc.record({
  type: paymentMethodTypeArb,
  identifier: identifierArb,
})

// Generator for payment method without identifier
const paymentMethodWithoutIdentifierArb: fc.Arbitrary<PaymentMethod> = fc.record({
  type: paymentMethodTypeArb,
  identifier: fc.constant(undefined),
})

// Generator for any payment method (with or without identifier)
const paymentMethodArb: fc.Arbitrary<PaymentMethod> = fc.oneof(
  paymentMethodWithIdentifierArb,
  paymentMethodWithoutIdentifierArb
)

describe("Payment Method Display Properties", () => {
  /**
   * Property 1: Payment method display formatting
   * For any expense with a payment method, the formatted display string SHALL contain
   * the payment method type, and if an identifier exists, it SHALL appear in brackets
   * immediately after the type.
   *
   * Feature: payment-settings-improvements, Property 1: Payment method display formatting
   * Validates: Requirements 1.1, 1.2, 1.3
   */
  describe("Property 1: Payment method display formatting", () => {
    it("should return undefined when no payment method is provided", () => {
      fc.assert(
        fc.property(fc.constant(undefined), (paymentMethod) => {
          const result = formatPaymentMethodDisplay(paymentMethod)
          return result === undefined
        }),
        { numRuns: 100 }
      )
    })

    it("should contain the payment method type in the output", () => {
      fc.assert(
        fc.property(paymentMethodArb, (paymentMethod) => {
          const result = formatPaymentMethodDisplay(paymentMethod)
          // Result should always contain the type
          return result !== undefined && result.includes(paymentMethod.type)
        }),
        { numRuns: 100 }
      )
    })

    it("should format as 'Type (identifier)' when identifier exists", () => {
      fc.assert(
        fc.property(paymentMethodWithIdentifierArb, (paymentMethod) => {
          const result = formatPaymentMethodDisplay(paymentMethod)
          const expected = `${paymentMethod.type} (${paymentMethod.identifier})`
          return result === expected
        }),
        { numRuns: 100 }
      )
    })

    it("should format as just 'Type' when no identifier exists", () => {
      fc.assert(
        fc.property(paymentMethodWithoutIdentifierArb, (paymentMethod) => {
          const result = formatPaymentMethodDisplay(paymentMethod)
          return result === paymentMethod.type
        }),
        { numRuns: 100 }
      )
    })

    it("should include identifier in brackets immediately after type when present", () => {
      fc.assert(
        fc.property(paymentMethodWithIdentifierArb, (paymentMethod) => {
          const result = formatPaymentMethodDisplay(paymentMethod)
          if (!result || !paymentMethod.identifier) return false

          // Check that identifier appears in brackets after the type
          const expectedPattern = `${paymentMethod.type} (${paymentMethod.identifier})`
          return result === expectedPattern
        }),
        { numRuns: 100 }
      )
    })

    it("should not include brackets when no identifier exists", () => {
      fc.assert(
        fc.property(paymentMethodWithoutIdentifierArb, (paymentMethod) => {
          const result = formatPaymentMethodDisplay(paymentMethod)
          if (!result) return false

          // Result should not contain brackets
          return !result.includes("(") && !result.includes(")")
        }),
        { numRuns: 100 }
      )
    })
  })
})
