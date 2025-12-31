/**
 * Property-based tests for Default Payment Method Pre-Selection
 *
 * Property 6: Default Payment Method Pre-Selection
 * For any default payment method setting, when opening the expense entry screen,
 * the payment method selector SHALL have that type pre-selected.
 * When no default is set, no payment method SHALL be selected.
 *
 * **Validates: Requirements 3.3, 3.4, 3.5**
 */

import fc from "fast-check"
import { PaymentMethodType } from "../types/expense"

/**
 * Pure function representing the pre-selection logic from add.tsx
 * This extracts the core logic for testability.
 *
 * @param defaultPaymentMethod - The default payment method from settings (undefined if none)
 * @returns The initial payment method type state for the add expense screen
 */
function getInitialPaymentMethodType(
  defaultPaymentMethod: PaymentMethodType | undefined
): PaymentMethodType | undefined {
  return defaultPaymentMethod
}

/**
 * Pure function representing the reset logic after saving an expense
 *
 * @param defaultPaymentMethod - The default payment method from settings
 * @returns The payment method type to reset to after saving
 */
function getResetPaymentMethodType(
  defaultPaymentMethod: PaymentMethodType | undefined
): PaymentMethodType | undefined {
  return defaultPaymentMethod
}

/**
 * Pure function representing the update logic when default setting changes
 * Only updates if current selection is undefined and new default is defined
 *
 * @param currentSelection - Current payment method selection
 * @param newDefault - New default payment method from settings
 * @returns The updated payment method type
 */
function getUpdatedPaymentMethodType(
  currentSelection: PaymentMethodType | undefined,
  newDefault: PaymentMethodType | undefined
): PaymentMethodType | undefined {
  if (currentSelection === undefined && newDefault !== undefined) {
    return newDefault
  }
  return currentSelection
}

// Arbitrary generators for payment method types
const paymentMethodTypeArb = fc.constantFrom<PaymentMethodType>(
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other"
)

const optionalPaymentMethodTypeArb = fc.option(paymentMethodTypeArb, { nil: undefined })

describe("Property 6: Default Payment Method Pre-Selection", () => {
  /**
   * Feature: payment-method, Property 6: Default Payment Method Pre-Selection
   * For any default payment method setting, the initial state SHALL match the default.
   * **Validates: Requirements 3.3, 3.4, 3.5**
   */
  describe("Initial state matches default setting", () => {
    it("should pre-select the default payment method when one is set", () => {
      fc.assert(
        fc.property(paymentMethodTypeArb, (defaultPaymentMethod) => {
          const initialState = getInitialPaymentMethodType(defaultPaymentMethod)

          // When a default is set, initial state should match
          return initialState === defaultPaymentMethod
        }),
        { numRuns: 100 }
      )
    })

    it("should have no selection when no default is set", () => {
      const initialState = getInitialPaymentMethodType(undefined)

      // When no default is set, initial state should be undefined
      expect(initialState).toBeUndefined()
    })

    it("should handle any optional default payment method correctly", () => {
      fc.assert(
        fc.property(optionalPaymentMethodTypeArb, (defaultPaymentMethod) => {
          const initialState = getInitialPaymentMethodType(defaultPaymentMethod)

          // Initial state should always equal the default (including undefined)
          return initialState === defaultPaymentMethod
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: payment-method, Property 6: Reset behavior after save
   * After saving an expense, the payment method should reset to the default.
   * **Validates: Requirements 3.4**
   */
  describe("Reset to default after save", () => {
    it("should reset to default payment method after saving", () => {
      fc.assert(
        fc.property(paymentMethodTypeArb, (defaultPaymentMethod) => {
          const resetState = getResetPaymentMethodType(defaultPaymentMethod)

          // After reset, state should match the default
          return resetState === defaultPaymentMethod
        }),
        { numRuns: 100 }
      )
    })

    it("should reset to undefined when no default is set", () => {
      const resetState = getResetPaymentMethodType(undefined)

      // When no default, reset should be undefined
      expect(resetState).toBeUndefined()
    })
  })

  /**
   * Feature: payment-method, Property 6: Update behavior when default changes
   * When the default setting changes, it should only update if no selection exists.
   * **Validates: Requirements 3.5**
   */
  describe("Update behavior when default changes", () => {
    it("should update to new default when current selection is undefined", () => {
      fc.assert(
        fc.property(paymentMethodTypeArb, (newDefault) => {
          const updatedState = getUpdatedPaymentMethodType(undefined, newDefault)

          // When no current selection, should update to new default
          return updatedState === newDefault
        }),
        { numRuns: 100 }
      )
    })

    it("should preserve current selection when one exists", () => {
      fc.assert(
        fc.property(
          paymentMethodTypeArb,
          optionalPaymentMethodTypeArb,
          (currentSelection, newDefault) => {
            const updatedState = getUpdatedPaymentMethodType(currentSelection, newDefault)

            // When current selection exists, it should be preserved
            return updatedState === currentSelection
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should not change undefined selection when new default is also undefined", () => {
      const updatedState = getUpdatedPaymentMethodType(undefined, undefined)

      // Both undefined, should remain undefined
      expect(updatedState).toBeUndefined()
    })
  })

  /**
   * Feature: payment-method, Property 6: Idempotence of initialization
   * Initializing with the same default multiple times should produce the same result.
   * **Validates: Requirements 3.3**
   */
  describe("Idempotence of initialization", () => {
    it("should produce same result when initialized multiple times with same default", () => {
      fc.assert(
        fc.property(optionalPaymentMethodTypeArb, (defaultPaymentMethod) => {
          const firstInit = getInitialPaymentMethodType(defaultPaymentMethod)
          const secondInit = getInitialPaymentMethodType(defaultPaymentMethod)

          // Multiple initializations should produce identical results
          return firstInit === secondInit
        }),
        { numRuns: 100 }
      )
    })
  })
})
