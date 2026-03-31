/**
 * Property-based tests for ImportHistoryView filtering logic
 * Feature: sms-import-gaps
 */

import fc from "fast-check"
import { Expense } from "../../../types/expense"
import { SMSImportMetadata } from "../../../types/sms-import"
import { getImportStatus, matchesFilter, formatImportDate } from "./import-history-utils"

// --- Arbitraries ---

const dateArb = fc
  .integer({
    min: new Date("2024-01-01").getTime(),
    max: new Date("2026-12-31").getTime(),
  })
  .map((ts) => new Date(ts).toISOString())

const importMetadataArb = (userCorrected: boolean): fc.Arbitrary<SMSImportMetadata> =>
  fc.record({
    source: fc.constant("sms" as const),
    sender: fc.stringMatching(/^[A-Z]{2}-[A-Z]{4,8}$/),
    messageId: fc.stringMatching(/^[a-z0-9]{5,15}$/),
    confidenceScore: fc.double({ min: 0, max: 1, noNaN: true }),
    parsedAt: dateArb,
    reviewedAt: dateArb,
    userCorrected: fc.constant(userCorrected),
  })

// Helper to build an auto-imported expense
const autoImportedExpenseArb = (userCorrected: boolean): fc.Arbitrary<Expense> =>
  fc.record({
    id: fc.uuid(),
    amount: fc.double({ min: 1, max: 100000, noNaN: true }),
    currency: fc.constantFrom("INR", "USD", "EUR"),
    category: fc.constantFrom("Food", "Transport", "Shopping", "Other"),
    date: dateArb,
    note: fc.string({ minLength: 1, maxLength: 30 }),
    createdAt: dateArb,
    updatedAt: dateArb,
    source: fc.constant("auto-imported" as const),
    importMetadata: importMetadataArb(userCorrected),
  })

// Manual expense (no source or source = 'manual')
const manualExpenseArb: fc.Arbitrary<Expense> = fc.record({
  id: fc.uuid(),
  amount: fc.double({ min: 1, max: 100000, noNaN: true }),
  category: fc.constantFrom("Food", "Transport", "Shopping", "Other"),
  date: dateArb,
  note: fc.string({ minLength: 1, maxLength: 30 }),
  createdAt: dateArb,
  updatedAt: dateArb,
  source: fc.constantFrom("manual" as const, undefined),
})

// Mixed expense list with both auto-imported and manual
const mixedExpenseListArb = fc
  .tuple(
    fc.array(autoImportedExpenseArb(false), { minLength: 0, maxLength: 5 }),
    fc.array(autoImportedExpenseArb(true), { minLength: 0, maxLength: 5 }),
    fc.array(manualExpenseArb, { minLength: 0, maxLength: 5 })
  )
  .map(([confirmed, edited, manual]) => [...confirmed, ...edited, ...manual])

// --- Tests ---

describe("ImportHistoryView Filtering Logic", () => {
  /**
   * Property 6: Import History Filtering Correctness
   * For any set of expenses and filter value, the filtered result SHALL display
   * exactly the matching auto-imported subset.
   */
  describe("Property 6: Import History Filtering Correctness", () => {
    it("filter 'all' SHALL include every auto-imported expense and no manual expenses", () => {
      fc.assert(
        fc.property(mixedExpenseListArb, (expenses) => {
          const autoImported = expenses.filter((e) => e.source === "auto-imported")
          const filtered = autoImported.filter((e) => matchesFilter(e, "all"))

          expect(filtered).toHaveLength(autoImported.length)
        }),
        { numRuns: 100 }
      )
    })

    it("filter 'confirmed' SHALL include only auto-imported expenses where userCorrected is falsy", () => {
      fc.assert(
        fc.property(mixedExpenseListArb, (expenses) => {
          const autoImported = expenses.filter((e) => e.source === "auto-imported")
          const filtered = autoImported.filter((e) => matchesFilter(e, "confirmed"))

          for (const expense of filtered) {
            expect(expense.importMetadata?.userCorrected).toBeFalsy()
          }

          // Every confirmed auto-imported expense should be included
          const expectedConfirmed = autoImported.filter(
            (e) => !e.importMetadata?.userCorrected
          )
          expect(filtered).toHaveLength(expectedConfirmed.length)
        }),
        { numRuns: 100 }
      )
    })

    it("filter 'edited' SHALL include only auto-imported expenses where userCorrected is true", () => {
      fc.assert(
        fc.property(mixedExpenseListArb, (expenses) => {
          const autoImported = expenses.filter((e) => e.source === "auto-imported")
          const filtered = autoImported.filter((e) => matchesFilter(e, "edited"))

          for (const expense of filtered) {
            expect(expense.importMetadata?.userCorrected).toBe(true)
          }

          const expectedEdited = autoImported.filter(
            (e) => e.importMetadata?.userCorrected === true
          )
          expect(filtered).toHaveLength(expectedEdited.length)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe("getImportStatus", () => {
    it("should return 'edited' when userCorrected is true", () => {
      fc.assert(
        fc.property(autoImportedExpenseArb(true), (expense) => {
          expect(getImportStatus(expense)).toBe("edited")
        }),
        { numRuns: 100 }
      )
    })

    it("should return 'confirmed' when userCorrected is falsy", () => {
      fc.assert(
        fc.property(autoImportedExpenseArb(false), (expense) => {
          expect(getImportStatus(expense)).toBe("confirmed")
        }),
        { numRuns: 100 }
      )
    })
  })

  describe("formatImportDate", () => {
    it("should use importMetadata.parsedAt when available", () => {
      fc.assert(
        fc.property(autoImportedExpenseArb(false), (expense) => {
          const result = formatImportDate(expense)
          const expected = new Date(expense.importMetadata!.parsedAt).toLocaleDateString()
          expect(result).toBe(expected)
        }),
        { numRuns: 100 }
      )
    })

    it("should fall back to createdAt when importMetadata is absent", () => {
      fc.assert(
        fc.property(manualExpenseArb, (expense) => {
          const result = formatImportDate(expense)
          const expected = new Date(expense.createdAt).toLocaleDateString()
          expect(result).toBe(expected)
        }),
        { numRuns: 100 }
      )
    })
  })
})
