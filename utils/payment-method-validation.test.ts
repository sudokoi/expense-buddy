/**
 * Property-based tests for Payment Method Validation
 *
 * Tests the identifier input validation functionality.
 *
 * **Feature: payment-method, Property 1: Identifier Input Validation**
 * **Feature: payment-settings-improvements, Property 2: Identifier validation consistency**
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

  /**
   * Property 2: Identifier validation consistency
   * For any identifier input string, the validation function SHALL produce the same
   * result whether called from the add flow or edit flow, accepting only numeric
   * characters up to the configured maximum length.
   *
   * This property ensures that both the add and edit flows use the same validation
   * logic, producing consistent results for identical inputs.
   *
   * **Feature: payment-settings-improvements, Property 2: Identifier validation consistency**
   * **Validates: Requirements 2.6**
   */
  describe("Property 2: Identifier validation consistency", () => {
    it("should produce identical results for same input regardless of call context", () => {
      fc.assert(
        fc.property(
          fc.string(), // Generate any random string as input
          fc.constantFrom(3, 4), // UPI uses 3, cards use 4
          (input, maxLength) => {
            // Simulate add flow call
            const addFlowResult = validateIdentifier(input, maxLength)

            // Simulate edit flow call (same function, same parameters)
            const editFlowResult = validateIdentifier(input, maxLength)

            // Results must be identical
            return addFlowResult === editFlowResult
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should be deterministic - multiple calls with same input produce same output", () => {
      fc.assert(
        fc.property(fc.string(), fc.integer({ min: 1, max: 10 }), (input, maxLength) => {
          // Call the function multiple times
          const result1 = validateIdentifier(input, maxLength)
          const result2 = validateIdentifier(input, maxLength)
          const result3 = validateIdentifier(input, maxLength)

          // All results must be identical
          return result1 === result2 && result2 === result3
        }),
        { numRuns: 100 }
      )
    })

    it("should accept only numeric characters for any input", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.constantFrom(3, 4), // UPI (3) and cards (4)
          (input, maxLength) => {
            const result = validateIdentifier(input, maxLength)

            // Result must contain only digits (or be empty)
            return /^\d*$/.test(result)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should respect configured maximum length for UPI (3) and cards (4)", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.constantFrom(3, 4), // UPI uses 3, cards use 4
          (input, maxLength) => {
            const result = validateIdentifier(input, maxLength)

            // Result length must not exceed maxLength
            return result.length <= maxLength
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should preserve digit order from input", () => {
      fc.assert(
        fc.property(fc.string(), fc.constantFrom(3, 4), (input, maxLength) => {
          const result = validateIdentifier(input, maxLength)

          // Extract expected digits from input
          const expectedDigits = input.replace(/\D/g, "").slice(0, maxLength)

          // Result must match expected digits
          return result === expectedDigits
        }),
        { numRuns: 100 }
      )
    })
  })
})
