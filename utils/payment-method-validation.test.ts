/**
 * Property-based tests for Payment Method Validation
 *
 * Tests the identifier input validation functionality.
 *
 * **Feature: payment-method, Property 1: Identifier Input Validation**
 */

import fc from "fast-check"
import { validateIdentifier } from "./payment-method-validation"

describe("Payment Method Validation Properties", () => {
  /**
   * Property 1: Identifier Input Validation
   * For any string input to the identifier field, the resulting value SHALL
   * contain only digits and be at most `maxLength` characters (3 for UPI, 4 for cards).
   *
   * **Validates: Requirements 1.5**
   */
  describe("Property 1: Identifier Input Validation", () => {
    it("should return only digits for any input string", () => {
      fc.assert(
        fc.property(
          fc.string(), // Generate any random string
          fc.integer({ min: 1, max: 10 }), // Generate maxLength between 1 and 10
          (input, maxLength) => {
            const result = validateIdentifier(input, maxLength)

            // Result should contain only digits
            const onlyDigits = /^\d*$/.test(result)
            return onlyDigits
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should respect maxLength constraint for any input", () => {
      fc.assert(
        fc.property(
          fc.string(), // Generate any random string
          fc.integer({ min: 1, max: 10 }), // Generate maxLength between 1 and 10
          (input, maxLength) => {
            const result = validateIdentifier(input, maxLength)

            // Result length should be at most maxLength
            return result.length <= maxLength
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should preserve digits from input up to maxLength", () => {
      fc.assert(
        fc.property(
          fc.string(), // Generate any random string
          fc.integer({ min: 1, max: 10 }), // Generate maxLength between 1 and 10
          (input, maxLength) => {
            const result = validateIdentifier(input, maxLength)

            // Extract digits from input manually
            const expectedDigits = input.replace(/\D/g, "").slice(0, maxLength)

            // Result should match expected digits
            return result === expectedDigits
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should work correctly with UPI maxLength of 3", () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = validateIdentifier(input, 3)

          // Result should contain only digits
          const onlyDigits = /^\d*$/.test(result)
          // Result should be at most 3 characters
          const withinLength = result.length <= 3

          return onlyDigits && withinLength
        }),
        { numRuns: 100 }
      )
    })

    it("should work correctly with card maxLength of 4", () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = validateIdentifier(input, 4)

          // Result should contain only digits
          const onlyDigits = /^\d*$/.test(result)
          // Result should be at most 4 characters
          const withinLength = result.length <= 4

          return onlyDigits && withinLength
        }),
        { numRuns: 100 }
      )
    })

    it("should strip all non-digit characters", () => {
      fc.assert(
        fc.property(
          // Generate strings with mixed content: digits, letters, special chars
          fc.array(
            fc.oneof(
              fc.integer({ min: 0, max: 9 }).map((n) => n.toString()),
              fc.constantFrom("a", "b", "c", "!", "@", "#", " ", "-", ".")
            ),
            { minLength: 0, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 10 }),
          (chars, maxLength) => {
            const input = chars.join("")
            const result = validateIdentifier(input, maxLength)

            // Count digits in original input
            const originalDigits = input.replace(/\D/g, "")
            const expectedLength = Math.min(originalDigits.length, maxLength)

            // Result should have correct length
            return result.length === expectedLength && /^\d*$/.test(result)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should return empty string for input with no digits", () => {
      fc.assert(
        fc.property(
          // Generate strings with no digits
          fc.string().filter((s) => !/\d/.test(s)),
          fc.integer({ min: 1, max: 10 }),
          (input, maxLength) => {
            const result = validateIdentifier(input, maxLength)

            // Result should be empty
            return result === ""
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should handle empty string input", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (maxLength) => {
          const result = validateIdentifier("", maxLength)

          // Result should be empty
          return result === ""
        }),
        { numRuns: 100 }
      )
    })
  })
})
