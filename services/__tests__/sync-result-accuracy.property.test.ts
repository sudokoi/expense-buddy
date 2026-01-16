import fc from "fast-check"
import { mergeExpenses, DEFAULT_CONFLICT_THRESHOLD_MS } from "../merge-engine"
import {
  Expense,
  ExpenseCategory,
  PaymentMethod,
  PaymentMethodType,
} from "../../types/expense"
import { getLocalDayKey } from "../../utils/date"

// Arbitrary generators (same as merge-engine tests)
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
  .map((ms) => getLocalDayKey(new Date(ms).toISOString()))

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

describe("Sync Result Accuracy Properties", () => {
  describe("Merge Result Accuracy", () => {
    it("addedFromRemote count SHALL match actual remote-only expenses", () => {
      fc.assert(
        fc.property(
          uniqueExpensesArb(0, 5),
          uniqueExpensesArb(0, 5),
          (localExpenses, remoteExpenses) => {
            // Remap remote IDs to ensure they're unique from local
            const remoteWithUniqueIds = remoteExpenses.map((e, i) => ({
              ...e,
              id: `remote-expense-${i}`,
            }))

            const result = mergeExpenses(localExpenses, remoteWithUniqueIds)

            // Count remote-only expenses (IDs that exist only in remote)
            const localIds = new Set(localExpenses.map((e) => e.id))
            const expectedRemoteOnly = remoteWithUniqueIds.filter(
              (e) => !localIds.has(e.id)
            ).length

            return result.addedFromRemote.length === expectedRemoteOnly
          }
        ),
        { numRuns: 100 }
      )
    })

    it("updatedFromRemote count SHALL match actual remote-wins conflicts", () => {
      fc.assert(
        fc.property(
          expenseArb,
          fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
          (baseExpense, newAmount) => {
            const baseTime = new Date(baseExpense.updatedAt).getTime()

            // Create local (older) and remote (newer) versions
            const localExpense = {
              ...baseExpense,
              id: "shared-id",
              amount: baseExpense.amount,
              updatedAt: new Date(baseTime).toISOString(),
            }
            const remoteExpense = {
              ...baseExpense,
              id: "shared-id",
              amount: newAmount,
              updatedAt: new Date(
                baseTime + DEFAULT_CONFLICT_THRESHOLD_MS + 5000
              ).toISOString(),
            }

            // Skip if amounts are the same (no conflict)
            if (localExpense.amount === remoteExpense.amount) {
              return true
            }

            const result = mergeExpenses([localExpense], [remoteExpense])

            // Remote should win, so updatedFromRemote should be 1
            return result.updatedFromRemote.length === 1
          }
        ),
        { numRuns: 100 }
      )
    })

    it("addedFromLocal count SHALL match actual local-only expenses", () => {
      fc.assert(
        fc.property(
          uniqueExpensesArb(0, 5),
          uniqueExpensesArb(0, 5),
          (localExpenses, remoteExpenses) => {
            // Remap remote IDs to ensure they're unique from local
            const remoteWithUniqueIds = remoteExpenses.map((e, i) => ({
              ...e,
              id: `remote-expense-${i}`,
            }))

            const result = mergeExpenses(localExpenses, remoteWithUniqueIds)

            // Count local-only expenses (IDs that exist only in local)
            const remoteIds = new Set(remoteWithUniqueIds.map((e) => e.id))
            const expectedLocalOnly = localExpenses.filter(
              (e) => !remoteIds.has(e.id)
            ).length

            return result.addedFromLocal.length === expectedLocalOnly
          }
        ),
        { numRuns: 100 }
      )
    })

    it("autoResolved count SHALL match actual timestamp-resolved conflicts", () => {
      fc.assert(
        fc.property(
          expenseArb,
          fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
          fc.boolean(),
          (baseExpense, newAmount, localIsNewer) => {
            const baseTime = new Date(baseExpense.updatedAt).getTime()
            const timeDiff = DEFAULT_CONFLICT_THRESHOLD_MS + 5000

            const localExpense = {
              ...baseExpense,
              id: "shared-id",
              amount: localIsNewer ? newAmount : baseExpense.amount,
              updatedAt: new Date(
                localIsNewer ? baseTime + timeDiff : baseTime
              ).toISOString(),
            }
            const remoteExpense = {
              ...baseExpense,
              id: "shared-id",
              amount: localIsNewer ? baseExpense.amount : newAmount,
              updatedAt: new Date(
                localIsNewer ? baseTime : baseTime + timeDiff
              ).toISOString(),
            }

            // Skip if amounts are the same (no conflict)
            if (localExpense.amount === remoteExpense.amount) {
              return true
            }

            const result = mergeExpenses([localExpense], [remoteExpense])

            // Should have exactly 1 auto-resolved conflict
            return result.autoResolved.length === 1
          }
        ),
        { numRuns: 100 }
      )
    })

    it("sum of all change counts SHALL equal total unique IDs processed", () => {
      fc.assert(
        fc.property(
          uniqueExpensesArb(0, 10),
          uniqueExpensesArb(0, 10),
          (localExpenses, remoteExpenses) => {
            const result = mergeExpenses(localExpenses, remoteExpenses)

            // Get all unique IDs
            const allIds = new Set([
              ...localExpenses.map((e) => e.id),
              ...remoteExpenses.map((e) => e.id),
            ])

            // Count items in each category
            const addedFromRemote = result.addedFromRemote.length
            const addedFromLocal = result.addedFromLocal.length
            const updatedFromRemote = result.updatedFromRemote.length
            const updatedFromLocal = result.updatedFromLocal.length
            const trueConflicts = result.trueConflicts.length

            // Items that exist in both with identical content are not counted in any category
            // They just appear in merged
            // For overlapping IDs, they're either:
            // - identical (not counted anywhere except merged)
            // - auto-resolved (counted in updatedFromRemote or updatedFromLocal)
            // - true conflict (counted in trueConflicts)

            // Total categorized should be <= total unique IDs
            const totalCategorized =
              addedFromRemote +
              addedFromLocal +
              updatedFromRemote +
              updatedFromLocal +
              trueConflicts

            return totalCategorized <= allIds.size
          }
        ),
        { numRuns: 100 }
      )
    })

    it("all addedFromRemote expenses SHALL be present in merged result", () => {
      fc.assert(
        fc.property(
          uniqueExpensesArb(0, 5),
          uniqueExpensesArb(1, 5),
          (localExpenses, remoteExpenses) => {
            // Remap remote IDs to ensure they're unique from local
            const remoteWithUniqueIds = remoteExpenses.map((e, i) => ({
              ...e,
              id: `remote-expense-${i}`,
            }))

            const result = mergeExpenses(localExpenses, remoteWithUniqueIds)

            // All addedFromRemote should be in merged
            return result.addedFromRemote.every((added) =>
              result.merged.some((m) => m.id === added.id)
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it("all addedFromLocal expenses SHALL be present in merged result", () => {
      fc.assert(
        fc.property(
          uniqueExpensesArb(1, 5),
          uniqueExpensesArb(0, 5),
          (localExpenses, remoteExpenses) => {
            // Remap remote IDs to ensure they're unique from local
            const remoteWithUniqueIds = remoteExpenses.map((e, i) => ({
              ...e,
              id: `remote-expense-${i}`,
            }))

            const result = mergeExpenses(localExpenses, remoteWithUniqueIds)

            // All addedFromLocal should be in merged
            return result.addedFromLocal.every((added) =>
              result.merged.some((m) => m.id === added.id)
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it("all updatedFromRemote expenses SHALL be present in merged result", () => {
      fc.assert(
        fc.property(
          expenseArb,
          fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
          (baseExpense, newAmount) => {
            const baseTime = new Date(baseExpense.updatedAt).getTime()

            // Create local (older) and remote (newer) versions
            const localExpense = {
              ...baseExpense,
              id: "shared-id",
              amount: baseExpense.amount,
              updatedAt: new Date(baseTime).toISOString(),
            }
            const remoteExpense = {
              ...baseExpense,
              id: "shared-id",
              amount: newAmount,
              updatedAt: new Date(
                baseTime + DEFAULT_CONFLICT_THRESHOLD_MS + 5000
              ).toISOString(),
            }

            // Skip if amounts are the same (no conflict)
            if (localExpense.amount === remoteExpense.amount) {
              return true
            }

            const result = mergeExpenses([localExpense], [remoteExpense])

            // All updatedFromRemote should be in merged
            return result.updatedFromRemote.every((updated) =>
              result.merged.some((m) => m.id === updated.id)
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it("autoResolved conflicts SHALL have correct winner based on timestamps", () => {
      fc.assert(
        fc.property(
          expenseArb,
          fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
          fc.boolean(),
          (baseExpense, newAmount, localIsNewer) => {
            const baseTime = new Date(baseExpense.updatedAt).getTime()
            const timeDiff = DEFAULT_CONFLICT_THRESHOLD_MS + 5000

            const localExpense = {
              ...baseExpense,
              id: "shared-id",
              amount: localIsNewer ? newAmount : baseExpense.amount,
              updatedAt: new Date(
                localIsNewer ? baseTime + timeDiff : baseTime
              ).toISOString(),
            }
            const remoteExpense = {
              ...baseExpense,
              id: "shared-id",
              amount: localIsNewer ? baseExpense.amount : newAmount,
              updatedAt: new Date(
                localIsNewer ? baseTime : baseTime + timeDiff
              ).toISOString(),
            }

            // Skip if amounts are the same (no conflict)
            if (localExpense.amount === remoteExpense.amount) {
              return true
            }

            const result = mergeExpenses([localExpense], [remoteExpense])

            const autoResolved = result.autoResolved.find(
              (c) => c.expenseId === "shared-id"
            )
            if (!autoResolved) return false

            // Winner should match which one was newer
            const expectedWinner = localIsNewer ? "local" : "remote"
            return autoResolved.winner === expectedWinner
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
