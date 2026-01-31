/**
 * Property-based tests for Currency Utilities
 * Feature: codebase-improvements
 *
 * These tests verify that currency formatting, symbol extraction, and
 * effective currency computation work correctly across various inputs.
 */

import * as fc from "fast-check"
import {
  getFallbackCurrency,
  getCurrencySymbol,
  computeEffectiveCurrency,
} from "./currency"

describe("getFallbackCurrency", () => {
  it("should always return INR", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const result = getFallbackCurrency()
        expect(result).toBe("INR")
        return true
      }),
      { numRuns: 10 }
    )
  })
})

describe("getCurrencySymbol", () => {
  it("should return a non-empty string for valid currency codes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("INR", "USD", "EUR", "GBP", "JPY", "CAD", "AUD"),
        (currencyCode) => {
          const symbol = getCurrencySymbol(currencyCode)

          expect(typeof symbol).toBe("string")
          expect(symbol.length).toBeGreaterThan(0)

          return true
        }
      ),
      { numRuns: 50 }
    )
  })

  it("should return a string for any input code", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 10 }), (code) => {
        const symbol = getCurrencySymbol(code)

        // Should always return a non-empty string (either the symbol or the code)
        expect(typeof symbol).toBe("string")
        expect(symbol.length).toBeGreaterThan(0)

        return true
      }),
      { numRuns: 50 }
    )
  })
})

describe("computeEffectiveCurrency", () => {
  it("should return selected currency when it's available", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("INR", "USD", "EUR"),
        fc.array(fc.constantFrom("INR", "USD", "EUR"), { minLength: 1, maxLength: 5 }),
        fc.constantFrom("INR", "USD", "EUR"),
        (selected, available, settingsDefault) => {
          // Ensure selected is in available
          const availableWithSelected = available.includes(selected)
            ? available
            : [...available, selected]

          const expensesByCurrency = new Map(availableWithSelected.map((c) => [c, []]))

          const result = computeEffectiveCurrency(
            selected,
            availableWithSelected,
            expensesByCurrency,
            settingsDefault
          )

          expect(result).toBe(selected)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should return the only available currency when there's exactly one", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("INR", "USD", "EUR"),
        fc.constantFrom("INR", "USD", "EUR"),
        (onlyCurrency, settingsDefault) => {
          const expensesByCurrency = new Map([[onlyCurrency, []]])

          const result = computeEffectiveCurrency(
            null, // No selection
            [onlyCurrency],
            expensesByCurrency,
            settingsDefault
          )

          expect(result).toBe(onlyCurrency)

          return true
        }
      ),
      { numRuns: 50 }
    )
  })

  it("should return settings default when available in data", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("INR", "USD", "EUR"), { minLength: 2, maxLength: 5 }),
        fc.constantFrom("INR", "USD", "EUR"),
        (available, settingsDefault) => {
          // Ensure settings default is in available
          const availableWithDefault = available.includes(settingsDefault)
            ? available
            : [...available, settingsDefault]

          const expensesByCurrency = new Map(availableWithDefault.map((c) => [c, []]))

          const result = computeEffectiveCurrency(
            null, // No selection
            availableWithDefault,
            expensesByCurrency,
            settingsDefault
          )

          expect(result).toBe(settingsDefault)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should return first available when no selection and settings default not available", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("INR", "USD", "EUR", "GBP", "JPY", "CAD"), {
          minLength: 2,
          maxLength: 5,
        }),
        fc.constantFrom("INR", "USD", "EUR", "GBP", "JPY", "CAD"),
        (available, settingsDefault) => {
          // Ensure settings default is NOT in available
          const availableWithoutDefault = available.filter((c) => c !== settingsDefault)

          if (availableWithoutDefault.length === 0) {
            return true // Skip if all currencies filtered out
          }

          const expensesByCurrency = new Map(availableWithoutDefault.map((c) => [c, []]))

          const result = computeEffectiveCurrency(
            null, // No selection
            availableWithoutDefault,
            expensesByCurrency,
            settingsDefault
          )

          // Should return first available
          expect(result).toBe(availableWithoutDefault[0])

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should return settings default when no currencies available", () => {
    fc.assert(
      fc.property(fc.constantFrom("INR", "USD", "EUR"), (settingsDefault) => {
        const expensesByCurrency = new Map()

        const result = computeEffectiveCurrency(
          null,
          [],
          expensesByCurrency,
          settingsDefault
        )

        expect(result).toBe(settingsDefault)

        return true
      }),
      { numRuns: 50 }
    )
  })
})
