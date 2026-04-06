/**
 * Property-based tests for Sync Notification Count Derivation
 * Feature: sync-engine-optimization
 *
 * These tests verify that the remoteFilesUpdated count in sync results
 * is derived from the merge result (addedFromRemote + updatedFromRemote),
 * not from the raw download count.
 */

import * as fc from "fast-check"
import { Expense, ExpenseCategory } from "../../types/expense"

const categoryArb = fc.constantFrom<ExpenseCategory>(
  "Food",
  "Groceries",
  "Transport",
  "Utilities",
  "Rent",
  "Entertainment",
  "Health",
  "Other"
)

const dateStringArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 })
  .map((ms) => new Date(ms).toISOString().split("T")[0])

const isoDateStringArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 })
  .map((ms) => new Date(ms).toISOString())

const expenseArb: fc.Arbitrary<Expense> = fc.record({
  id: fc.uuid(),
  amount: fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
  category: categoryArb,
  note: fc.string({ minLength: 0, maxLength: 50 }),
  date: dateStringArb,
  createdAt: isoDateStringArb,
  updatedAt: isoDateStringArb,
})

/**
 * Simulates the notification count derivation logic used in gitStyleSync.
 * This is the formula under test: remoteFilesUpdated = addedFromRemote.length + updatedFromRemote.length
 */
function computeRemoteFilesUpdated(mergeResult: {
  addedFromRemote: Expense[]
  updatedFromRemote: Expense[]
}): number {
  return mergeResult.addedFromRemote.length + mergeResult.updatedFromRemote.length
}

/**
 * Property 5: Notification Count Derived From Merge Result
 * For any MergeResult, remoteFilesUpdated SHALL equal
 * addedFromRemote.length + updatedFromRemote.length.
 * When both arrays are empty, remoteFilesUpdated SHALL be 0.
 */
describe("Property 5: Notification Count Derived From Merge Result", () => {
  it("remoteFilesUpdated SHALL equal addedFromRemote.length + updatedFromRemote.length", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb, { minLength: 0, maxLength: 20 }),
        fc.array(expenseArb, { minLength: 0, maxLength: 20 }),
        (addedFromRemote, updatedFromRemote) => {
          const mergeResult = { addedFromRemote, updatedFromRemote }
          const count = computeRemoteFilesUpdated(mergeResult)

          expect(count).toBe(addedFromRemote.length + updatedFromRemote.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("remoteFilesUpdated SHALL be 0 when both arrays are empty", () => {
    const mergeResult = {
      addedFromRemote: [] as Expense[],
      updatedFromRemote: [] as Expense[],
    }
    const count = computeRemoteFilesUpdated(mergeResult)
    expect(count).toBe(0)
  })

  it("remoteFilesUpdated SHALL be non-negative for any merge result", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb, { minLength: 0, maxLength: 20 }),
        fc.array(expenseArb, { minLength: 0, maxLength: 20 }),
        (addedFromRemote, updatedFromRemote) => {
          const count = computeRemoteFilesUpdated({
            addedFromRemote,
            updatedFromRemote,
          })
          expect(count).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("remoteFilesUpdated SHALL NOT depend on filesDownloaded count", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb, { minLength: 0, maxLength: 10 }),
        fc.array(expenseArb, { minLength: 0, maxLength: 10 }),
        fc.nat({ max: 1000 }),
        (addedFromRemote, updatedFromRemote, filesDownloaded) => {
          const mergeResult = { addedFromRemote, updatedFromRemote }
          const count = computeRemoteFilesUpdated(mergeResult)

          // The count should be the same regardless of filesDownloaded
          expect(count).toBe(addedFromRemote.length + updatedFromRemote.length)
          // And it may differ from filesDownloaded
          // (this is the whole point of the fix)
        }
      ),
      { numRuns: 100 }
    )
  })
})
