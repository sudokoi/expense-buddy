/**
 * Property-based tests for CSV Handler
 * Feature: payment-method
 */

import fc from "fast-check"
import { exportToCSV, importFromCSV } from "./csv-handler"
import { Expense, ExpenseCategory, PaymentMethodType } from "../types/expense"
import { format, subDays } from "date-fns"
import { getFallbackCurrency } from "../utils/currency"

// Helper to generate valid expense categories
const categoryArb = fc.constantFrom<ExpenseCategory>(
  "Food",
  "Groceries",
  "Transport",
  "Rent",
  "Utilities",
  "Entertainment",
  "Health",
  "Other"
)

// Helper to generate valid payment method types
const paymentMethodTypeArb = fc.constantFrom<PaymentMethodType>(
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other"
)

const currencyArb = fc.constantFrom("INR", "USD", "GBP", "EUR", "JPY")

// Helper to generate a valid expense with optional payment method
const expenseWithPaymentMethodArb = fc.record({
  id: fc.uuid(),
  amount: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  currency: currencyArb,
  category: categoryArb,
  date: fc
    .integer({ min: 0, max: 60 })
    .map((daysAgo) => format(subDays(new Date(), daysAgo), "yyyy-MM-dd")),
  note: fc.string({ maxLength: 50 }).map((s) => s.replace(/[\n\r,]/g, " ")), // Avoid CSV-breaking characters
  paymentMethod: fc.option(
    fc.record({
      type: paymentMethodTypeArb,
      identifier: fc.option(fc.stringMatching(/^\d{3,4}$/), { nil: undefined }),
      instrumentId: fc.option(fc.uuid(), { nil: undefined }),
    }),
    { nil: undefined }
  ),
  createdAt: fc.constant(new Date().toISOString()),
  updatedAt: fc.constant(new Date().toISOString()),
  deletedAt: fc.option(fc.constant(new Date().toISOString()), { nil: undefined }),
}) as fc.Arbitrary<Expense>

/**
 * Helper to compare two expenses for equivalence after CSV round-trip
 * Note: Some fields may have minor differences due to CSV serialization
 */
function expensesAreEquivalent(original: Expense, imported: Expense): boolean {
  // ID should match exactly
  if (original.id !== imported.id) return false

  // Amount should match within floating point tolerance
  if (Math.abs(original.amount - imported.amount) > 0.01) return false

  // Currency should match (legacy undefined treated as fallback INR)
  const originalCurrency = original.currency || getFallbackCurrency()
  const importedCurrency = imported.currency || getFallbackCurrency()
  if (originalCurrency !== importedCurrency) return false

  // Category should match exactly
  if (original.category !== imported.category) return false

  // Date should match exactly
  if (original.date !== imported.date) return false

  // Note should match (empty string vs undefined are equivalent)
  const originalNote = original.note || ""
  const importedNote = imported.note || ""
  if (originalNote !== importedNote) return false

  // Payment method comparison
  if (!original.paymentMethod && !imported.paymentMethod) {
    // Both undefined - OK
  } else if (original.paymentMethod && imported.paymentMethod) {
    // Both defined - compare
    if (original.paymentMethod.type !== imported.paymentMethod.type) return false

    // Identifier comparison (empty string vs undefined are equivalent)
    const originalId = original.paymentMethod.identifier || ""
    const importedId = imported.paymentMethod.identifier || ""
    if (originalId !== importedId) return false

    const originalInstrumentId = original.paymentMethod.instrumentId || ""
    const importedInstrumentId = imported.paymentMethod.instrumentId || ""
    if (originalInstrumentId !== importedInstrumentId) return false
  } else {
    // One defined, one not - not equivalent
    return false
  }

  // Timestamps should match
  if (original.createdAt !== imported.createdAt) return false
  if (original.updatedAt !== imported.updatedAt) return false

  // deletedAt comparison (empty string vs undefined are equivalent)
  const originalDeletedAt = original.deletedAt || ""
  const importedDeletedAt = imported.deletedAt || ""
  if (originalDeletedAt !== importedDeletedAt) return false

  return true
}

describe("CSV Handler Properties", () => {
  /**
   * For any list of expenses (with or without payment methods), exporting to CSV
   * and then importing the CSV SHALL produce an equivalent list of expenses with
   * payment method data preserved.
   */
  describe("CSV Round-Trip Consistency", () => {
    it("should preserve all expense data through CSV export/import round-trip", () => {
      fc.assert(
        fc.property(
          fc.array(expenseWithPaymentMethodArb, { minLength: 1, maxLength: 50 }),
          (expenses) => {
            // Export to CSV
            const csv = exportToCSV(expenses)

            // Import back from CSV
            const imported = importFromCSV(csv)

            // Should have same number of expenses
            if (expenses.length !== imported.length) {
              return false
            }

            // Each expense should be equivalent
            for (let i = 0; i < expenses.length; i++) {
              if (!expensesAreEquivalent(expenses[i], imported[i])) {
                return false
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should preserve expenses with payment methods", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              amount: fc.float({
                min: Math.fround(0.01),
                max: Math.fround(10000),
                noNaN: true,
              }),
              category: categoryArb,
              date: fc
                .integer({ min: 0, max: 60 })
                .map((daysAgo) => format(subDays(new Date(), daysAgo), "yyyy-MM-dd")),
              note: fc.string({ maxLength: 50 }).map((s) => s.replace(/[\n\r,]/g, " ")),
              currency: currencyArb,
              paymentMethod: fc.record({
                type: paymentMethodTypeArb,
                identifier: fc.option(fc.stringMatching(/^\d{3,4}$/), { nil: undefined }),
                instrumentId: fc.option(fc.uuid(), { nil: undefined }),
              }),
              createdAt: fc.constant(new Date().toISOString()),
              updatedAt: fc.constant(new Date().toISOString()),
              deletedAt: fc.option(fc.constant(new Date().toISOString()), {
                nil: undefined,
              }),
            }) as fc.Arbitrary<Expense>,
            { minLength: 1, maxLength: 30 }
          ),
          (expenses) => {
            const csv = exportToCSV(expenses)
            const imported = importFromCSV(csv)

            // All imported expenses should have payment methods
            for (let i = 0; i < expenses.length; i++) {
              const original = expenses[i]
              const imp = imported[i]

              if (!imp.paymentMethod) {
                return false // Should have payment method
              }

              if (original.paymentMethod!.type !== imp.paymentMethod.type) {
                return false
              }

              // Identifier comparison
              const originalId = original.paymentMethod!.identifier || ""
              const importedId = imp.paymentMethod.identifier || ""
              if (originalId !== importedId) {
                return false
              }

              const originalInstrumentId = original.paymentMethod!.instrumentId || ""
              const importedInstrumentId = imp.paymentMethod.instrumentId || ""
              if (originalInstrumentId !== importedInstrumentId) {
                return false
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should preserve expenses without payment methods", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              amount: fc.float({
                min: Math.fround(0.01),
                max: Math.fround(10000),
                noNaN: true,
              }),
              category: categoryArb,
              date: fc
                .integer({ min: 0, max: 60 })
                .map((daysAgo) => format(subDays(new Date(), daysAgo), "yyyy-MM-dd")),
              note: fc.string({ maxLength: 50 }).map((s) => s.replace(/[\n\r,]/g, " ")),
              currency: currencyArb,
              paymentMethod: fc.constant(undefined),
              createdAt: fc.constant(new Date().toISOString()),
              updatedAt: fc.constant(new Date().toISOString()),
              deletedAt: fc.option(fc.constant(new Date().toISOString()), {
                nil: undefined,
              }),
            }) as fc.Arbitrary<Expense>,
            { minLength: 1, maxLength: 30 }
          ),
          (expenses) => {
            const csv = exportToCSV(expenses)
            const imported = importFromCSV(csv)

            // All imported expenses should NOT have payment methods
            for (const imp of imported) {
              if (imp.paymentMethod !== undefined) {
                return false // Should not have payment method
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should handle empty expense list", () => {
      const csv = exportToCSV([])
      // Papa.unparse returns empty string for empty array
      // This is expected behavior - no data means no CSV content
      expect(csv).toBe("")
    })

    it("should handle mixed expenses (with and without payment methods)", () => {
      fc.assert(
        fc.property(
          fc.array(expenseWithPaymentMethodArb, { minLength: 2, maxLength: 30 }),
          (expenses) => {
            const csv = exportToCSV(expenses)
            const imported = importFromCSV(csv)

            // Count expenses with/without payment methods in original
            const originalWithPM = expenses.filter((e) => e.paymentMethod).length
            const originalWithoutPM = expenses.filter((e) => !e.paymentMethod).length

            // Count in imported
            const importedWithPM = imported.filter((e) => e.paymentMethod).length
            const importedWithoutPM = imported.filter((e) => !e.paymentMethod).length

            // Counts should match
            return (
              originalWithPM === importedWithPM && originalWithoutPM === importedWithoutPM
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should handle backward compatibility with CSVs missing deletedAt column", () => {
      // Simulate a CSV from before soft delete was added (no deletedAt column)
      const legacyCsv = `id,amount,category,date,note,paymentMethodType,paymentMethodId,createdAt,updatedAt
abc123,100,Food,2024-01-15,Lunch,Cash,,2024-01-15T12:00:00.000Z,2024-01-15T12:00:00.000Z
def456,50.5,Transport,2024-01-16,Bus fare,UPI,1234,2024-01-16T08:00:00.000Z,2024-01-16T08:00:00.000Z`

      const imported = importFromCSV(legacyCsv)

      // Should import successfully
      expect(imported).toHaveLength(2)

      // All expenses should have deletedAt as undefined (not deleted)
      expect(imported[0].deletedAt).toBeUndefined()
      expect(imported[1].deletedAt).toBeUndefined()

      // Missing currency should default to fallback (INR)
      expect(imported[0].currency).toBe(getFallbackCurrency())
      expect(imported[1].currency).toBe(getFallbackCurrency())

      // Other fields should be preserved
      expect(imported[0].id).toBe("abc123")
      expect(imported[0].amount).toBe(100)
      expect(imported[1].paymentMethod?.type).toBe("UPI")
      expect(imported[1].paymentMethod?.identifier).toBe("1234")
    })

    it("should preserve soft-deleted expenses through round-trip", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              amount: fc.float({
                min: Math.fround(0.01),
                max: Math.fround(10000),
                noNaN: true,
              }),
              category: categoryArb,
              date: fc
                .integer({ min: 0, max: 60 })
                .map((daysAgo) => format(subDays(new Date(), daysAgo), "yyyy-MM-dd")),
              note: fc.string({ maxLength: 50 }).map((s) => s.replace(/[\n\r,]/g, " ")),
              currency: currencyArb,
              paymentMethod: fc.constant(undefined),
              createdAt: fc.constant(new Date().toISOString()),
              updatedAt: fc.constant(new Date().toISOString()),
              // Always set deletedAt for this test
              deletedAt: fc.constant(new Date().toISOString()),
            }) as fc.Arbitrary<Expense>,
            { minLength: 1, maxLength: 20 }
          ),
          (expenses) => {
            const csv = exportToCSV(expenses)
            const imported = importFromCSV(csv)

            // All imported expenses should have deletedAt set
            for (let i = 0; i < expenses.length; i++) {
              if (!imported[i].deletedAt) {
                return false // Should have deletedAt
              }
              if (expenses[i].deletedAt !== imported[i].deletedAt) {
                return false // deletedAt should match
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
