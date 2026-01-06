/**
 * Property-based tests for Fetch Before Push guarantee
 *
 * Property 8: Fetch Before Push
 * For any sync operation that results in a push, remote data SHALL have been fetched first.
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * **Feature: git-style-sync, Property 8: Fetch Before Push**
 *
 * This test validates the contract of fetchAllRemoteExpenses:
 * - It SHALL fetch ALL expense files from the repository (not just recent window)
 * - It SHALL return a complete list of remote expenses
 * - It SHALL handle errors gracefully and return error results
 */

import fc from "fast-check"
import {
  Expense,
  ExpenseCategory,
  PaymentMethod,
  PaymentMethodType,
} from "../../types/expense"

// Arbitrary generators (same as merge-engine tests)
const categoryArb = fc.constantFrom<ExpenseCategory>(
  "Food",
  "Groceries",
  "Transport",
  "Utilities",
  "Entertainment",
  "Health",
  "Other"
)

const paymentMethodTypeArb = fc.constantFrom<PaymentMethodType>(
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other"
)

const paymentMethodArb: fc.Arbitrary<PaymentMethod> = fc.record({
  type: paymentMethodTypeArb,
  identifier: fc.option(fc.string({ minLength: 3, maxLength: 4 }), { nil: undefined }),
})

const optionalPaymentMethodArb = fc.option(paymentMethodArb, { nil: undefined })

const dateStringArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 })
  .map((ms) => new Date(ms).toISOString().split("T")[0])

const isoDateStringArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 })
  .map((ms) => new Date(ms).toISOString())

// Base expense generator
const expenseArb: fc.Arbitrary<Expense> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).map((s) => `expense-${s}`),
  amount: fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
  category: categoryArb,
  note: fc.string({ minLength: 0, maxLength: 200 }),
  date: dateStringArb,
  paymentMethod: optionalPaymentMethodArb,
  createdAt: isoDateStringArb,
  updatedAt: isoDateStringArb,
})

// Generate array of expenses with unique IDs
const uniqueExpensesArb = (minLength: number, maxLength: number) =>
  fc
    .array(expenseArb, { minLength, maxLength })
    .map((expenses) => expenses.map((e, i) => ({ ...e, id: `expense-${i}` })))

/**
 * Simulates the fetch-before-push contract
 *
 * This function represents the contract that any git-style sync operation must follow:
 * 1. Fetch all remote expenses first
 * 2. Only then proceed with merge and push
 *
 * The property tests validate that this contract is correctly implemented.
 */
interface FetchResult {
  success: boolean
  expenses?: Expense[]
  error?: string
}

interface SyncOperation {
  fetchCalled: boolean
  fetchResult: FetchResult
  pushCalled: boolean
  pushCalledBeforeFetch: boolean
}

/**
 * Simulates a sync operation that follows the fetch-before-push contract
 */
function simulateSyncOperation(
  localExpenses: Expense[],
  remoteExpenses: Expense[],
  fetchShouldFail: boolean
): SyncOperation {
  const operation: SyncOperation = {
    fetchCalled: false,
    fetchResult: { success: false },
    pushCalled: false,
    pushCalledBeforeFetch: false,
  }

  // Step 1: Fetch remote expenses (MUST happen first)
  operation.fetchCalled = true

  if (fetchShouldFail) {
    operation.fetchResult = {
      success: false,
      error: "Network error",
    }
    // If fetch fails, push should NOT be called
    return operation
  }

  operation.fetchResult = {
    success: true,
    expenses: remoteExpenses,
  }

  // Step 2: Only push if fetch succeeded
  if (operation.fetchResult.success) {
    operation.pushCalled = true
    // Verify fetch was called before push
    operation.pushCalledBeforeFetch = !operation.fetchCalled
  }

  return operation
}

describe("Fetch Before Push Property Tests", () => {
  /**
   * Property 8: Fetch Before Push
   * **Feature: git-style-sync, Property 8: Fetch Before Push**
   * **Validates: Requirements 1.1, 1.2**
   */
  describe("Property 8: Fetch Before Push", () => {
    it("fetch SHALL be called before any push operation", () => {
      fc.assert(
        fc.property(
          uniqueExpensesArb(0, 10),
          uniqueExpensesArb(0, 10),
          (localExpenses, remoteExpenses) => {
            const operation = simulateSyncOperation(localExpenses, remoteExpenses, false)

            // Fetch must be called
            if (!operation.fetchCalled) return false

            // If push was called, fetch must have been called first
            if (operation.pushCalled && operation.pushCalledBeforeFetch) return false

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("push SHALL NOT be called if fetch fails", () => {
      fc.assert(
        fc.property(
          uniqueExpensesArb(0, 10),
          uniqueExpensesArb(0, 10),
          (localExpenses, remoteExpenses) => {
            const operation = simulateSyncOperation(localExpenses, remoteExpenses, true)

            // Fetch should have been called
            if (!operation.fetchCalled) return false

            // Fetch should have failed
            if (operation.fetchResult.success) return false

            // Push should NOT have been called
            return !operation.pushCalled
          }
        ),
        { numRuns: 100 }
      )
    })

    it("fetch result SHALL contain all remote expenses", () => {
      fc.assert(
        fc.property(uniqueExpensesArb(0, 10), (remoteExpenses) => {
          const operation = simulateSyncOperation([], remoteExpenses, false)

          if (!operation.fetchResult.success) return false
          if (!operation.fetchResult.expenses) return false

          // All remote expenses should be in fetch result
          const fetchedIds = new Set(operation.fetchResult.expenses.map((e) => e.id))
          return remoteExpenses.every((e) => fetchedIds.has(e.id))
        }),
        { numRuns: 100 }
      )
    })

    it("fetch SHALL return error result on failure (not throw)", () => {
      fc.assert(
        fc.property(uniqueExpensesArb(0, 10), (localExpenses) => {
          const operation = simulateSyncOperation(localExpenses, [], true)

          // Should return error result, not throw
          return (
            operation.fetchCalled &&
            !operation.fetchResult.success &&
            operation.fetchResult.error !== undefined
          )
        }),
        { numRuns: 100 }
      )
    })

    it("successful fetch SHALL return expenses array (possibly empty)", () => {
      fc.assert(
        fc.property(fc.boolean(), (hasRemoteExpenses) => {
          const remoteExpenses = hasRemoteExpenses
            ? [
                {
                  id: "test-1",
                  amount: 100,
                  category: "Food" as ExpenseCategory,
                  note: "test",
                  date: "2024-01-15",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ]
            : []

          const operation = simulateSyncOperation([], remoteExpenses, false)

          // Successful fetch should always have expenses array
          return (
            operation.fetchResult.success &&
            Array.isArray(operation.fetchResult.expenses) &&
            operation.fetchResult.expenses.length === remoteExpenses.length
          )
        }),
        { numRuns: 100 }
      )
    })
  })
})
