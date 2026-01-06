import fc from "fast-check"
import { mergeExpenses, DEFAULT_CONFLICT_THRESHOLD_MS } from "../merge-engine"
import {
  Expense,
  ExpenseCategory,
  PaymentMethod,
  PaymentMethodType,
} from "../../types/expense"

// Extended Expense type with soft delete support (will be added in Task 2)
type ExpenseWithSoftDelete = Expense & { deletedAt?: string }

// Arbitrary generators
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

// Expense with soft delete support
const expenseWithSoftDeleteArb: fc.Arbitrary<ExpenseWithSoftDelete> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).map((s) => `expense-${s}`),
  amount: fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
  category: categoryArb,
  note: fc.string({ minLength: 0, maxLength: 200 }),
  date: dateStringArb,
  paymentMethod: optionalPaymentMethodArb,
  createdAt: isoDateStringArb,
  updatedAt: isoDateStringArb,
  deletedAt: fc.option(isoDateStringArb, { nil: undefined }),
})

// Generate array of expenses with unique IDs
const uniqueExpensesArb = (minLength: number, maxLength: number) =>
  fc
    .array(expenseArb, { minLength, maxLength })
    .map((expenses) => expenses.map((e, i) => ({ ...e, id: `expense-${i}` })))

// Generate array of expenses with soft delete and unique IDs
const uniqueExpensesWithSoftDeleteArb = (minLength: number, maxLength: number) =>
  fc
    .array(expenseWithSoftDeleteArb, { minLength, maxLength })
    .map((expenses) => expenses.map((e, i) => ({ ...e, id: `expense-${i}` })))

describe("MergeEngine Properties", () => {
  describe("Property 1: Merge Completeness", () => {
    it("merge result SHALL contain all unique IDs from both local and remote", () => {
      fc.assert(
        fc.property(
          uniqueExpensesArb(0, 10),
          uniqueExpensesArb(0, 10),
          (localExpenses, remoteExpenses) => {
            // Remap remote IDs to avoid overlap for this test
            const remoteWithUniqueIds = remoteExpenses.map((e, i) => ({
              ...e,
              id: `remote-expense-${i}`,
            }))

            const result = mergeExpenses(localExpenses, remoteWithUniqueIds)

            // Get all unique IDs from both sets
            const allIds = new Set([
              ...localExpenses.map((e) => e.id),
              ...remoteWithUniqueIds.map((e) => e.id),
            ])

            // Merged result should contain all IDs (excluding true conflicts which are not in merged yet)
            const mergedIds = new Set(result.merged.map((e) => e.id))
            const conflictIds = new Set(result.trueConflicts.map((c) => c.expenseId))

            // All IDs should be either in merged or in conflicts
            for (const id of allIds) {
              if (!mergedIds.has(id) && !conflictIds.has(id)) {
                return false
              }
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("local-only expenses SHALL be included in merge result", () => {
      fc.assert(
        fc.property(uniqueExpensesArb(1, 5), (localExpenses) => {
          const result = mergeExpenses(localExpenses, [])

          // All local expenses should be in merged result
          return localExpenses.every((local) =>
            result.merged.some((m) => m.id === local.id)
          )
        }),
        { numRuns: 100 }
      )
    })

    it("remote-only expenses SHALL be included in merge result", () => {
      fc.assert(
        fc.property(uniqueExpensesArb(1, 5), (remoteExpenses) => {
          const result = mergeExpenses([], remoteExpenses)

          // All remote expenses should be in merged result
          return remoteExpenses.every((remote) =>
            result.merged.some((m) => m.id === remote.id)
          )
        }),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 2: ID Uniqueness in Merge Result", () => {
    it("each expense ID SHALL appear exactly once in merge result", () => {
      fc.assert(
        fc.property(
          uniqueExpensesArb(0, 10),
          uniqueExpensesArb(0, 10),
          (localExpenses, remoteExpenses) => {
            const result = mergeExpenses(localExpenses, remoteExpenses)

            const ids = result.merged.map((e) => e.id)
            const uniqueIds = new Set(ids)

            return ids.length === uniqueIds.size
          }
        ),
        { numRuns: 100 }
      )
    })

    it("overlapping IDs SHALL result in single entry per ID", () => {
      fc.assert(
        fc.property(
          expenseArb,
          fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
          (baseExpense, newAmount) => {
            const localExpense = { ...baseExpense, id: "shared-id" }
            const remoteExpense = {
              ...baseExpense,
              id: "shared-id",
              amount: newAmount,
              updatedAt: new Date(
                new Date(baseExpense.updatedAt).getTime() + 10000
              ).toISOString(),
            }

            const result = mergeExpenses([localExpense], [remoteExpense])

            // Should have exactly one entry with this ID (either in merged or conflicts)
            const mergedCount = result.merged.filter((e) => e.id === "shared-id").length
            const conflictCount = result.trueConflicts.filter(
              (c) => c.expenseId === "shared-id"
            ).length

            return mergedCount + conflictCount === 1
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 3: Timestamp-Based Resolution", () => {
    it("newer local version SHALL win when timestamps differ significantly", () => {
      fc.assert(
        fc.property(
          expenseArb,
          fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
          (baseExpense, newAmount) => {
            const baseTime = new Date(baseExpense.updatedAt).getTime()

            // Local is newer by more than threshold
            const localExpense = {
              ...baseExpense,
              id: "test-id",
              amount: newAmount,
              updatedAt: new Date(
                baseTime + DEFAULT_CONFLICT_THRESHOLD_MS + 5000
              ).toISOString(),
            }
            const remoteExpense = {
              ...baseExpense,
              id: "test-id",
              updatedAt: new Date(baseTime).toISOString(),
            }

            const result = mergeExpenses([localExpense], [remoteExpense])

            // Local should win
            const merged = result.merged.find((e) => e.id === "test-id")
            return merged !== undefined && merged.amount === newAmount
          }
        ),
        { numRuns: 100 }
      )
    })

    it("newer remote version SHALL win when timestamps differ significantly", () => {
      fc.assert(
        fc.property(
          expenseArb,
          fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
          (baseExpense, newAmount) => {
            const baseTime = new Date(baseExpense.updatedAt).getTime()

            // Remote is newer by more than threshold
            const localExpense = {
              ...baseExpense,
              id: "test-id",
              updatedAt: new Date(baseTime).toISOString(),
            }
            const remoteExpense = {
              ...baseExpense,
              id: "test-id",
              amount: newAmount,
              updatedAt: new Date(
                baseTime + DEFAULT_CONFLICT_THRESHOLD_MS + 5000
              ).toISOString(),
            }

            const result = mergeExpenses([localExpense], [remoteExpense])

            // Remote should win
            const merged = result.merged.find((e) => e.id === "test-id")
            return merged !== undefined && merged.amount === newAmount
          }
        ),
        { numRuns: 100 }
      )
    })

    it("auto-resolved conflicts SHALL be tracked with correct winner", () => {
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
              id: "test-id",
              amount: localIsNewer ? newAmount : baseExpense.amount,
              updatedAt: new Date(
                localIsNewer ? baseTime + timeDiff : baseTime
              ).toISOString(),
            }
            const remoteExpense = {
              ...baseExpense,
              id: "test-id",
              amount: localIsNewer ? baseExpense.amount : newAmount,
              updatedAt: new Date(
                localIsNewer ? baseTime : baseTime + timeDiff
              ).toISOString(),
            }

            const result = mergeExpenses([localExpense], [remoteExpense])

            // Should have an auto-resolved conflict with correct winner
            const autoResolved = result.autoResolved.find(
              (c) => c.expenseId === "test-id"
            )
            if (!autoResolved) return false

            return autoResolved.winner === (localIsNewer ? "local" : "remote")
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 4: True Conflict Detection", () => {
    it("equal timestamps with different content SHALL be detected as true conflict", () => {
      fc.assert(
        fc.property(
          expenseArb,
          fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
          (baseExpense, newAmount) => {
            const sameTimestamp = new Date().toISOString()

            const localExpense = {
              ...baseExpense,
              id: "test-id",
              amount: baseExpense.amount,
              updatedAt: sameTimestamp,
            }
            const remoteExpense = {
              ...baseExpense,
              id: "test-id",
              amount: newAmount,
              updatedAt: sameTimestamp,
            }

            // Only test when amounts are actually different
            if (localExpense.amount === remoteExpense.amount) {
              return true // Skip this case - identical content
            }

            const result = mergeExpenses([localExpense], [remoteExpense])

            // Should be detected as true conflict
            return result.trueConflicts.some((c) => c.expenseId === "test-id")
          }
        ),
        { numRuns: 100 }
      )
    })

    it("timestamps within threshold SHALL be detected as true conflict", () => {
      fc.assert(
        fc.property(
          expenseArb,
          fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
          fc.integer({ min: 0, max: DEFAULT_CONFLICT_THRESHOLD_MS }),
          (baseExpense, newAmount, timeDiff) => {
            const baseTime = Date.now()

            const localExpense = {
              ...baseExpense,
              id: "test-id",
              amount: baseExpense.amount,
              updatedAt: new Date(baseTime).toISOString(),
            }
            const remoteExpense = {
              ...baseExpense,
              id: "test-id",
              amount: newAmount,
              updatedAt: new Date(baseTime + timeDiff).toISOString(),
            }

            // Only test when amounts are actually different
            if (localExpense.amount === remoteExpense.amount) {
              return true // Skip this case - identical content
            }

            const result = mergeExpenses([localExpense], [remoteExpense])

            // Should be detected as true conflict
            return result.trueConflicts.some((c) => c.expenseId === "test-id")
          }
        ),
        { numRuns: 100 }
      )
    })

    it("true conflicts SHALL include both local and remote versions", () => {
      fc.assert(
        fc.property(
          expenseArb,
          fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
          (baseExpense, newAmount) => {
            const sameTimestamp = new Date().toISOString()

            const localExpense = {
              ...baseExpense,
              id: "test-id",
              amount: baseExpense.amount,
              updatedAt: sameTimestamp,
            }
            const remoteExpense = {
              ...baseExpense,
              id: "test-id",
              amount: newAmount,
              updatedAt: sameTimestamp,
            }

            // Only test when amounts are actually different
            if (localExpense.amount === remoteExpense.amount) {
              return true // Skip this case
            }

            const result = mergeExpenses([localExpense], [remoteExpense])

            const conflict = result.trueConflicts.find((c) => c.expenseId === "test-id")
            if (!conflict) return false

            return (
              conflict.localVersion.amount === localExpense.amount &&
              conflict.remoteVersion.amount === remoteExpense.amount
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 5: Soft Delete Propagation", () => {
    it("soft-deleted expense from remote SHALL be included in merge result", () => {
      fc.assert(
        fc.property(expenseArb, isoDateStringArb, (baseExpense, deletedAt) => {
          const remoteExpense: ExpenseWithSoftDelete = {
            ...baseExpense,
            id: "test-id",
            deletedAt,
          }

          const result = mergeExpenses([], [remoteExpense as Expense])

          // Soft-deleted expense should be in merged result
          const merged = result.merged.find((e) => e.id === "test-id")
          return (
            merged !== undefined &&
            (merged as ExpenseWithSoftDelete).deletedAt === deletedAt
          )
        }),
        { numRuns: 100 }
      )
    })

    it("soft-deleted expense from local SHALL be included in merge result", () => {
      fc.assert(
        fc.property(expenseArb, isoDateStringArb, (baseExpense, deletedAt) => {
          const localExpense: ExpenseWithSoftDelete = {
            ...baseExpense,
            id: "test-id",
            deletedAt,
          }

          const result = mergeExpenses([localExpense as Expense], [])

          // Soft-deleted expense should be in merged result
          const merged = result.merged.find((e) => e.id === "test-id")
          return (
            merged !== undefined &&
            (merged as ExpenseWithSoftDelete).deletedAt === deletedAt
          )
        }),
        { numRuns: 100 }
      )
    })

    it("newer soft-delete SHALL win over older active version", () => {
      fc.assert(
        fc.property(expenseArb, isoDateStringArb, (baseExpense, deletedAt) => {
          const baseTime = new Date(baseExpense.updatedAt).getTime()

          // Local is active (older)
          const localExpense: ExpenseWithSoftDelete = {
            ...baseExpense,
            id: "test-id",
            updatedAt: new Date(baseTime).toISOString(),
            deletedAt: undefined,
          }

          // Remote is soft-deleted (newer)
          const remoteExpense: ExpenseWithSoftDelete = {
            ...baseExpense,
            id: "test-id",
            updatedAt: new Date(
              baseTime + DEFAULT_CONFLICT_THRESHOLD_MS + 5000
            ).toISOString(),
            deletedAt,
          }

          const result = mergeExpenses(
            [localExpense as Expense],
            [remoteExpense as Expense]
          )

          // Remote (soft-deleted) should win
          const merged = result.merged.find((e) => e.id === "test-id")
          return (
            merged !== undefined &&
            (merged as ExpenseWithSoftDelete).deletedAt === deletedAt
          )
        }),
        { numRuns: 100 }
      )
    })

    it("newer active version SHALL win over older soft-delete", () => {
      fc.assert(
        fc.property(expenseArb, isoDateStringArb, (baseExpense, deletedAt) => {
          const baseTime = new Date(baseExpense.updatedAt).getTime()

          // Local is soft-deleted (older)
          const localExpense: ExpenseWithSoftDelete = {
            ...baseExpense,
            id: "test-id",
            updatedAt: new Date(baseTime).toISOString(),
            deletedAt,
          }

          // Remote is active (newer)
          const remoteExpense: ExpenseWithSoftDelete = {
            ...baseExpense,
            id: "test-id",
            updatedAt: new Date(
              baseTime + DEFAULT_CONFLICT_THRESHOLD_MS + 5000
            ).toISOString(),
            deletedAt: undefined,
          }

          const result = mergeExpenses(
            [localExpense as Expense],
            [remoteExpense as Expense]
          )

          // Remote (active) should win
          const merged = result.merged.find((e) => e.id === "test-id")
          return (
            merged !== undefined &&
            (merged as ExpenseWithSoftDelete).deletedAt === undefined
          )
        }),
        { numRuns: 100 }
      )
    })

    it("deletedAt timestamp SHALL be preserved in merge result", () => {
      fc.assert(
        fc.property(uniqueExpensesWithSoftDeleteArb(1, 5), (expensesWithSoftDelete) => {
          const result = mergeExpenses(expensesWithSoftDelete as Expense[], [])

          // All deletedAt values should be preserved
          return expensesWithSoftDelete.every((original) => {
            const merged = result.merged.find((e) => e.id === original.id)
            if (!merged) return false
            return (merged as ExpenseWithSoftDelete).deletedAt === original.deletedAt
          })
        }),
        { numRuns: 100 }
      )
    })
  })
})
