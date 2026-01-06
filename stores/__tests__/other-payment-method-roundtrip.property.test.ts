/**
 * Property-based tests for Other Payment Method Description Round-Trip
 *
 * For any expense with "Other" payment method and a non-empty description,
 * syncing up and then syncing down SHALL preserve the description exactly.
 */

import fc from "fast-check"
import { exportToCSV, importFromCSV } from "../../services/csv-handler"
import { Expense, ExpenseCategory } from "../../types/expense"
import { format, subDays } from "date-fns"

// Helper to generate valid expense categories
const categoryArb = fc.constantFrom<ExpenseCategory>(
  "Food",
  "Groceries",
  "Transport",
  "Utilities",
  "Entertainment",
  "Health",
  "Other"
)

// Generator for non-empty description strings (alphanumeric and common punctuation)
// Avoiding CSV-breaking characters like newlines and commas
const descriptionArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .map((s) => s.replace(/[\n\r,]/g, " ").trim())
  .filter((s) => s.length > 0)

// Generator for expense with "Other" payment method and description
const expenseWithOtherPaymentMethodArb = fc.record({
  id: fc.uuid(),
  amount: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  category: categoryArb,
  date: fc
    .integer({ min: 0, max: 60 })
    .map((daysAgo) => format(subDays(new Date(), daysAgo), "yyyy-MM-dd")),
  note: fc.string({ maxLength: 50 }).map((s) => s.replace(/[\n\r,]/g, " ")),
  paymentMethod: fc.record({
    type: fc.constant("Other" as const),
    identifier: descriptionArb,
  }),
  createdAt: fc.constant(new Date().toISOString()),
  updatedAt: fc.constant(new Date().toISOString()),
}) as fc.Arbitrary<Expense>

// Generator for expense with "Other" payment method without description
const expenseWithOtherNoDescriptionArb = fc.record({
  id: fc.uuid(),
  amount: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  category: categoryArb,
  date: fc
    .integer({ min: 0, max: 60 })
    .map((daysAgo) => format(subDays(new Date(), daysAgo), "yyyy-MM-dd")),
  note: fc.string({ maxLength: 50 }).map((s) => s.replace(/[\n\r,]/g, " ")),
  paymentMethod: fc.record({
    type: fc.constant("Other" as const),
    identifier: fc.constant(undefined),
  }),
  createdAt: fc.constant(new Date().toISOString()),
  updatedAt: fc.constant(new Date().toISOString()),
}) as fc.Arbitrary<Expense>

describe("Other Payment Method Description Round-Trip Properties", () => {
  /**
   * Property 5: Other Payment Method Description Round-Trip
   * For any expense with "Other" payment method and a non-empty description,
   * syncing up and then syncing down SHALL preserve the description exactly.
   */
  describe("Property 5: Other Payment Method Description Round-Trip", () => {
    it("should preserve description for Other payment method through CSV round-trip", () => {
      fc.assert(
        fc.property(
          fc.array(expenseWithOtherPaymentMethodArb, { minLength: 1, maxLength: 30 }),
          (expenses) => {
            // Export to CSV (simulates sync up)
            const csv = exportToCSV(expenses)

            // Import from CSV (simulates sync down)
            const imported = importFromCSV(csv)

            // Should have same number of expenses
            if (expenses.length !== imported.length) {
              return false
            }

            // Each expense should preserve the description exactly
            for (let i = 0; i < expenses.length; i++) {
              const original = expenses[i]
              const imp = imported[i]

              // Payment method should exist
              if (!imp.paymentMethod) {
                return false
              }

              // Type should be "Other"
              if (imp.paymentMethod.type !== "Other") {
                return false
              }

              // Description should be preserved exactly
              if (original.paymentMethod!.identifier !== imp.paymentMethod.identifier) {
                return false
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should preserve Other payment method without description", () => {
      fc.assert(
        fc.property(
          fc.array(expenseWithOtherNoDescriptionArb, { minLength: 1, maxLength: 30 }),
          (expenses) => {
            // Export to CSV (simulates sync up)
            const csv = exportToCSV(expenses)

            // Import from CSV (simulates sync down)
            const imported = importFromCSV(csv)

            // Should have same number of expenses
            if (expenses.length !== imported.length) {
              return false
            }

            // Each expense should have Other payment method without description
            for (let i = 0; i < expenses.length; i++) {
              const imp = imported[i]

              // Payment method should exist
              if (!imp.paymentMethod) {
                return false
              }

              // Type should be "Other"
              if (imp.paymentMethod.type !== "Other") {
                return false
              }

              // Description should be undefined
              if (imp.paymentMethod.identifier !== undefined) {
                return false
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should handle mixed Other expenses (with and without descriptions)", () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(expenseWithOtherPaymentMethodArb, { minLength: 1, maxLength: 15 }),
            fc.array(expenseWithOtherNoDescriptionArb, { minLength: 1, maxLength: 15 })
          ),
          ([withDesc, withoutDesc]) => {
            const expenses = [...withDesc, ...withoutDesc]

            // Export to CSV (simulates sync up)
            const csv = exportToCSV(expenses)

            // Import from CSV (simulates sync down)
            const imported = importFromCSV(csv)

            // Should have same number of expenses
            if (expenses.length !== imported.length) {
              return false
            }

            // Count expenses with descriptions
            const originalWithDesc = expenses.filter(
              (e) => e.paymentMethod?.identifier
            ).length
            const importedWithDesc = imported.filter(
              (e) => e.paymentMethod?.identifier
            ).length

            // Counts should match
            return originalWithDesc === importedWithDesc
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
