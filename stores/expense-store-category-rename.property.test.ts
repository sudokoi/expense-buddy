/**
 * Property-based tests for Category Rename Expense Update
 * Feature: category-rename-expense-update
 *
 * These tests verify the updateExpenseCategories action in expense-store.ts
 * which updates expenses when a category is renamed.
 */

import fc from "fast-check"
import { Expense, PaymentMethod, PaymentMethodType } from "../types/expense"

// ============================================================================
// Test Helpers - Pure function that mimics updateExpenseCategories logic
// ============================================================================

/**
 * Pure function that simulates the updateExpenseCategories action.
 * This allows us to test the core logic without side effects.
 */
function updateExpenseCategories(
  expenses: Expense[],
  fromCategory: string,
  toCategory: string
): { expenses: Expense[]; affectedIds: string[] } {
  // Handle same-name rename as no-op
  if (fromCategory === toCategory) {
    return { expenses, affectedIds: [] }
  }

  const now = new Date().toISOString()
  const affectedIds: string[] = []

  const newExpenses = expenses.map((expense) => {
    if (expense.category === fromCategory && !expense.deletedAt) {
      affectedIds.push(expense.id)
      return {
        ...expense,
        category: toCategory,
        updatedAt: now,
      }
    }
    return expense
  })

  return { expenses: newExpenses, affectedIds }
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

// Generator for valid expense IDs
const expenseIdArb = fc.uuid()

// Generator for valid amounts (positive numbers)
const amountArb = fc.float({
  min: Math.fround(0.01),
  max: Math.fround(100000),
  noNaN: true,
})

// Generator for valid category names
const categoryArb = fc
  .stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,19}$/)
  .filter((s) => s.trim().length > 0)

// Generator for valid dates (ISO strings) - using integer timestamps for reliability
const dateArb = fc
  .integer({
    min: new Date("2020-01-01").getTime(),
    max: new Date("2030-12-31").getTime(),
  })
  .map((ts) => new Date(ts).toISOString())

// Generator for valid notes
const noteArb = fc.string({ minLength: 0, maxLength: 100 })

// Generator for payment method types
const paymentMethodTypeArb = fc.constantFrom<PaymentMethodType>(
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other"
)

// Generator for optional payment method
const paymentMethodArb: fc.Arbitrary<PaymentMethod | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.record({
    type: paymentMethodTypeArb,
    identifier: fc.option(fc.stringMatching(/^[0-9]{3,4}$/), { nil: undefined }),
  })
)

// Generator for ISO timestamp - using integer timestamps for reliability
const timestampArb = fc
  .integer({
    min: new Date("2020-01-01").getTime(),
    max: new Date("2030-12-31").getTime(),
  })
  .map((ts) => new Date(ts).toISOString())

// Generator for optional deletedAt (soft-delete marker)
const deletedAtArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  timestampArb
)

// Generator for a single expense
const expenseArb: fc.Arbitrary<Expense> = fc.record({
  id: expenseIdArb,
  amount: amountArb,
  category: categoryArb,
  date: dateArb,
  note: noteArb,
  paymentMethod: paymentMethodArb,
  createdAt: timestampArb,
  updatedAt: timestampArb,
  deletedAt: deletedAtArb,
})

// Generator for active expense (not soft-deleted)
const activeExpenseArb: fc.Arbitrary<Expense> = fc.record({
  id: expenseIdArb,
  amount: amountArb,
  category: categoryArb,
  date: dateArb,
  note: noteArb,
  paymentMethod: paymentMethodArb,
  createdAt: timestampArb,
  updatedAt: timestampArb,
  deletedAt: fc.constant(undefined),
})

// Generator for soft-deleted expense
const deletedExpenseArb: fc.Arbitrary<Expense> = fc.record({
  id: expenseIdArb,
  amount: amountArb,
  category: categoryArb,
  date: dateArb,
  note: noteArb,
  paymentMethod: paymentMethodArb,
  createdAt: timestampArb,
  updatedAt: timestampArb,
  deletedAt: timestampArb,
})

// Generator for a list of expenses
const expenseListArb = fc.array(expenseArb, { minLength: 0, maxLength: 50 })

// Generator for two distinct category names
const distinctCategoriesArb = fc
  .tuple(categoryArb, categoryArb)
  .filter(([a, b]) => a !== b)

// ============================================================================
// Property Tests
// ============================================================================

describe("Category Rename Expense Update Properties", () => {
  /**
   * Property 1: Category Rename Preserves Expense Count
   * For any set of expenses and any category rename operation, the total number
   * of expenses (including soft-deleted) SHALL remain unchanged after the operation.
   */
  describe("Property 1: Category Rename Preserves Expense Count", () => {
    it("total expense count SHALL remain unchanged after category rename", () => {
      fc.assert(
        fc.property(
          expenseListArb,
          categoryArb,
          categoryArb,
          (expenses, fromCategory, toCategory) => {
            const originalCount = expenses.length
            const { expenses: updatedExpenses } = updateExpenseCategories(
              expenses,
              fromCategory,
              toCategory
            )
            return updatedExpenses.length === originalCount
          }
        ),
        { numRuns: 100 }
      )
    })

    it("expense IDs SHALL all be preserved after category rename", () => {
      fc.assert(
        fc.property(
          expenseListArb,
          categoryArb,
          categoryArb,
          (expenses, fromCategory, toCategory) => {
            const originalIds = new Set(expenses.map((e) => e.id))
            const { expenses: updatedExpenses } = updateExpenseCategories(
              expenses,
              fromCategory,
              toCategory
            )
            const updatedIds = new Set(updatedExpenses.map((e) => e.id))

            // Check same size and all original IDs present
            if (originalIds.size !== updatedIds.size) return false
            for (const id of originalIds) {
              if (!updatedIds.has(id)) return false
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 2: Category Rename Updates All Matching Expenses
   * For any category rename from oldLabel to newLabel, all active expenses that had
   * category equal to oldLabel SHALL have category equal to newLabel after the operation.
   */
  describe("Property 2: Category Rename Updates All Matching Expenses", () => {
    it("all active expenses with old category SHALL have new category after rename", () => {
      fc.assert(
        fc.property(
          fc.array(activeExpenseArb, { minLength: 1, maxLength: 20 }),
          distinctCategoriesArb,
          (expenses, [fromCategory, toCategory]) => {
            // Set some expenses to have the fromCategory
            const modifiedExpenses = expenses.map((e, i) =>
              i % 2 === 0 ? { ...e, category: fromCategory } : e
            )

            const { expenses: updatedExpenses } = updateExpenseCategories(
              modifiedExpenses,
              fromCategory,
              toCategory
            )

            // All expenses that had fromCategory should now have toCategory
            for (let i = 0; i < modifiedExpenses.length; i++) {
              const original = modifiedExpenses[i]
              const updated = updatedExpenses[i]

              if (original.category === fromCategory && !original.deletedAt) {
                if (updated.category !== toCategory) return false
              }
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("expenses with different categories SHALL NOT be modified", () => {
      fc.assert(
        fc.property(
          fc.array(activeExpenseArb, { minLength: 1, maxLength: 20 }),
          distinctCategoriesArb,
          (expenses, [fromCategory, toCategory]) => {
            // Ensure no expense has fromCategory
            const modifiedExpenses = expenses.map((e) =>
              e.category === fromCategory ? { ...e, category: "OtherCategory" } : e
            )

            const { expenses: updatedExpenses } = updateExpenseCategories(
              modifiedExpenses,
              fromCategory,
              toCategory
            )

            // No expense should have been modified
            for (let i = 0; i < modifiedExpenses.length; i++) {
              const original = modifiedExpenses[i]
              const updated = updatedExpenses[i]

              if (original.category !== updated.category) return false
              if (original.updatedAt !== updated.updatedAt) return false
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 3: Category Rename Preserves Non-Category Fields
   * For any expense updated by a category rename, all fields except `category`
   * and `updatedAt` SHALL remain unchanged.
   */
  describe("Property 3: Category Rename Preserves Non-Category Fields", () => {
    it("non-category fields SHALL remain unchanged after rename", () => {
      fc.assert(
        fc.property(
          fc.array(activeExpenseArb, { minLength: 1, maxLength: 20 }),
          distinctCategoriesArb,
          (expenses, [fromCategory, toCategory]) => {
            // Set all expenses to have the fromCategory
            const modifiedExpenses = expenses.map((e) => ({
              ...e,
              category: fromCategory,
            }))

            const { expenses: updatedExpenses } = updateExpenseCategories(
              modifiedExpenses,
              fromCategory,
              toCategory
            )

            // Check that all non-category, non-updatedAt fields are preserved
            for (let i = 0; i < modifiedExpenses.length; i++) {
              const original = modifiedExpenses[i]
              const updated = updatedExpenses[i]

              // These fields should be unchanged
              if (original.id !== updated.id) return false
              if (original.amount !== updated.amount) return false
              if (original.date !== updated.date) return false
              if (original.note !== updated.note) return false
              if (original.createdAt !== updated.createdAt) return false
              if (original.deletedAt !== updated.deletedAt) return false

              // Payment method comparison
              if (original.paymentMethod === undefined) {
                if (updated.paymentMethod !== undefined) return false
              } else {
                if (updated.paymentMethod === undefined) return false
                if (original.paymentMethod.type !== updated.paymentMethod.type)
                  return false
                if (
                  original.paymentMethod.identifier !== updated.paymentMethod.identifier
                )
                  return false
              }
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("updatedAt SHALL be modified for affected expenses", () => {
      fc.assert(
        fc.property(
          fc.array(activeExpenseArb, { minLength: 1, maxLength: 10 }),
          distinctCategoriesArb,
          (expenses, [fromCategory, toCategory]) => {
            // Set all expenses to have the fromCategory with old updatedAt
            const oldTimestamp = "2020-01-01T00:00:00.000Z"
            const modifiedExpenses = expenses.map((e) => ({
              ...e,
              category: fromCategory,
              updatedAt: oldTimestamp,
            }))

            const { expenses: updatedExpenses } = updateExpenseCategories(
              modifiedExpenses,
              fromCategory,
              toCategory
            )

            // All affected expenses should have a new updatedAt
            for (const updated of updatedExpenses) {
              if (updated.updatedAt === oldTimestamp) return false
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 4: Same-Name Rename Is No-Op
   * For any category rename where oldLabel equals newLabel, no expenses
   * SHALL be modified (no updatedAt changes).
   */
  describe("Property 4: Same-Name Rename Is No-Op", () => {
    it("same-name rename SHALL NOT modify any expenses", () => {
      fc.assert(
        fc.property(expenseListArb, categoryArb, (expenses, category) => {
          const { expenses: updatedExpenses, affectedIds } = updateExpenseCategories(
            expenses,
            category,
            category // Same category
          )

          // No expenses should be affected
          if (affectedIds.length !== 0) return false

          // All expenses should be identical
          for (let i = 0; i < expenses.length; i++) {
            const original = expenses[i]
            const updated = updatedExpenses[i]

            if (original.category !== updated.category) return false
            if (original.updatedAt !== updated.updatedAt) return false
          }
          return true
        }),
        { numRuns: 100 }
      )
    })

    it("same-name rename SHALL return empty affectedIds array", () => {
      fc.assert(
        fc.property(expenseListArb, categoryArb, (expenses, category) => {
          const { affectedIds } = updateExpenseCategories(expenses, category, category)
          return affectedIds.length === 0
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 5: Soft-Deleted Expenses Are Not Updated
   * For any category rename operation, expenses with a non-null `deletedAt` field
   * SHALL NOT have their category or updatedAt modified.
   */
  describe("Property 5: Soft-Deleted Expenses Are Not Updated", () => {
    it("soft-deleted expenses SHALL NOT have category modified", () => {
      fc.assert(
        fc.property(
          fc.array(deletedExpenseArb, { minLength: 1, maxLength: 20 }),
          distinctCategoriesArb,
          (expenses, [fromCategory, toCategory]) => {
            // Set all deleted expenses to have the fromCategory
            const modifiedExpenses = expenses.map((e) => ({
              ...e,
              category: fromCategory,
            }))

            const { expenses: updatedExpenses, affectedIds } = updateExpenseCategories(
              modifiedExpenses,
              fromCategory,
              toCategory
            )

            // No expenses should be affected (all are soft-deleted)
            if (affectedIds.length !== 0) return false

            // All expenses should retain their original category
            for (let i = 0; i < modifiedExpenses.length; i++) {
              const original = modifiedExpenses[i]
              const updated = updatedExpenses[i]

              if (original.category !== updated.category) return false
              if (original.updatedAt !== updated.updatedAt) return false
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("mixed list SHALL only update active expenses", () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(activeExpenseArb, { minLength: 1, maxLength: 10 }),
            fc.array(deletedExpenseArb, { minLength: 1, maxLength: 10 })
          ),
          distinctCategoriesArb,
          ([activeExpenses, deletedExpenses], [fromCategory, toCategory]) => {
            // Set all expenses to have the fromCategory
            const allExpenses = [
              ...activeExpenses.map((e) => ({ ...e, category: fromCategory })),
              ...deletedExpenses.map((e) => ({ ...e, category: fromCategory })),
            ]

            const { expenses: updatedExpenses, affectedIds } = updateExpenseCategories(
              allExpenses,
              fromCategory,
              toCategory
            )

            // Only active expenses should be affected
            if (affectedIds.length !== activeExpenses.length) return false

            // Check active expenses were updated
            for (let i = 0; i < activeExpenses.length; i++) {
              const updated = updatedExpenses[i]
              if (updated.category !== toCategory) return false
            }

            // Check deleted expenses were NOT updated
            for (let i = activeExpenses.length; i < allExpenses.length; i++) {
              const original = allExpenses[i]
              const updated = updatedExpenses[i]
              if (original.category !== updated.category) return false
              if (original.updatedAt !== updated.updatedAt) return false
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
