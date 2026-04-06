/**
 * Property-based tests for Optimized Fetch Equivalence
 * Feature: sync-engine-optimization
 *
 * These tests verify that the optimized fetch (tree + SHA comparison + selective
 * download) produces the same expense set as the original fetch (download all).
 * The merge result is therefore identical regardless of which fetch strategy is used.
 */

import * as fc from "fast-check"
import { Expense, ExpenseCategory } from "../../types/expense"
import { groupExpensesByDay } from "../daily-file-manager"
import { classifyTreeEntries } from "../sync-manager"

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

const dayKeyArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`)

const shaArb = fc.stringMatching(/^[0-9a-f]{40}$/)

const isoDateStringArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 })
  .map((ms) => new Date(ms).toISOString())

const expenseForDayArb = (dayKey: string): fc.Arbitrary<Expense> =>
  fc.record({
    id: fc.uuid(),
    amount: fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
    category: categoryArb,
    note: fc.string({ minLength: 0, maxLength: 50 }),
    date: fc.constant(new Date(`${dayKey}T12:00:00.000Z`).toISOString()),
    createdAt: isoDateStringArb,
    updatedAt: isoDateStringArb,
  })

/** A remote file with its day key, tree entry, and the expenses it contains */
interface RemoteFile {
  dayKey: string
  path: string
  sha: string
  expenses: Expense[]
}

const remoteFileArb: fc.Arbitrary<RemoteFile> = dayKeyArb.chain((dayKey) =>
  fc
    .tuple(shaArb, fc.array(expenseForDayArb(dayKey), { minLength: 1, maxLength: 5 }))
    .map(([sha, expenses]) => ({
      dayKey,
      path: `expenses-${dayKey}.csv`,
      sha,
      expenses,
    }))
)

/**
 * Simulates the original fetch: downloads ALL files and returns all expenses.
 */
function originalFetch(remoteFiles: RemoteFile[]): Expense[] {
  return remoteFiles.flatMap((f) => f.expenses)
}

/**
 * Simulates the optimized fetch: uses SHA cache to skip unchanged files,
 * reuses local expenses for those, and "downloads" changed files.
 */
function optimizedFetch(
  remoteFiles: RemoteFile[],
  shaCache: { [filename: string]: string },
  localExpenses: Expense[]
): Expense[] {
  const localByDay = groupExpensesByDay(localExpenses)
  const treeEntries = remoteFiles.map((f) => ({ path: f.path, sha: f.sha }))

  const { changed, unchanged } = classifyTreeEntries(
    treeEntries,
    shaCache,
    new Set(localByDay.keys())
  )

  const result: Expense[] = []

  // Reuse local expenses for unchanged files
  for (const file of unchanged) {
    const dayExpenses = localByDay.get(file.dayKey)
    if (dayExpenses) {
      result.push(...dayExpenses)
    }
  }

  // "Download" changed files (simulate by using the remote file's expenses)
  for (const changedEntry of changed) {
    const remoteFile = remoteFiles.find((f) => f.path === changedEntry.path)
    if (remoteFile) {
      result.push(...remoteFile.expenses)
    }
  }

  return result
}

/**
 * Property 6: Optimized Fetch Produces Equivalent Merge Input
 * For any set of local expenses and remote state, the optimized fetch SHALL
 * produce the same expense set as the original fetch. The merge result SHALL
 * be identical regardless of which fetch strategy was used.
 */
describe("Property 6: Optimized Fetch Produces Equivalent Merge Input", () => {
  it("optimized fetch SHALL produce the same expense IDs as original fetch when cache is current", () => {
    fc.assert(
      fc.property(
        fc.array(remoteFileArb, { minLength: 1, maxLength: 10 }),
        (remoteFiles) => {
          // Deduplicate by day key
          const uniqueFiles = [...new Map(remoteFiles.map((f) => [f.dayKey, f])).values()]

          // Build a cache that matches all remote SHAs (all files unchanged)
          const shaCache: { [k: string]: string } = {}
          for (const file of uniqueFiles) {
            shaCache[file.path] = file.sha
          }

          // Local expenses match remote (the steady-state scenario)
          const localExpenses = uniqueFiles.flatMap((f) => f.expenses)

          const originalResult = originalFetch(uniqueFiles)
          const optimizedResult = optimizedFetch(uniqueFiles, shaCache, localExpenses)

          const originalIds = new Set(originalResult.map((e) => e.id))
          const optimizedIds = new Set(optimizedResult.map((e) => e.id))

          expect(optimizedIds.size).toBe(originalIds.size)
          for (const id of originalIds) {
            expect(optimizedIds.has(id)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("optimized fetch with empty cache SHALL produce the same expense IDs as original fetch", () => {
    fc.assert(
      fc.property(
        fc.array(remoteFileArb, { minLength: 1, maxLength: 10 }),
        (remoteFiles) => {
          const uniqueFiles = [...new Map(remoteFiles.map((f) => [f.dayKey, f])).values()]

          // Empty cache = cold start, all files are "changed" and downloaded
          const originalResult = originalFetch(uniqueFiles)
          const optimizedResult = optimizedFetch(uniqueFiles, {}, [])

          const originalIds = new Set(originalResult.map((e) => e.id))
          const optimizedIds = new Set(optimizedResult.map((e) => e.id))

          expect(optimizedIds.size).toBe(originalIds.size)
          for (const id of originalIds) {
            expect(optimizedIds.has(id)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("optimized fetch with partial cache SHALL produce the same expense IDs as original fetch", () => {
    fc.assert(
      fc.property(
        fc.array(remoteFileArb, { minLength: 2, maxLength: 10 }),
        (remoteFiles) => {
          const uniqueFiles = [...new Map(remoteFiles.map((f) => [f.dayKey, f])).values()]
          if (uniqueFiles.length < 2) return

          // Cache only the first half of files
          const half = Math.floor(uniqueFiles.length / 2)
          const shaCache: { [k: string]: string } = {}
          for (let i = 0; i < half; i++) {
            shaCache[uniqueFiles[i].path] = uniqueFiles[i].sha
          }

          // Local expenses only for cached files
          const localExpenses = uniqueFiles.slice(0, half).flatMap((f) => f.expenses)

          const originalResult = originalFetch(uniqueFiles)
          const optimizedResult = optimizedFetch(uniqueFiles, shaCache, localExpenses)

          const originalIds = new Set(originalResult.map((e) => e.id))
          const optimizedIds = new Set(optimizedResult.map((e) => e.id))

          expect(optimizedIds.size).toBe(originalIds.size)
          for (const id of originalIds) {
            expect(optimizedIds.has(id)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("optimized fetch with stale cache (SHA mismatch) SHALL download changed files", () => {
    fc.assert(
      fc.property(
        fc.array(remoteFileArb, { minLength: 1, maxLength: 10 }),
        (remoteFiles) => {
          const uniqueFiles = [...new Map(remoteFiles.map((f) => [f.dayKey, f])).values()]

          // Cache has wrong SHAs for all files (stale cache)
          const shaCache: { [k: string]: string } = {}
          for (const file of uniqueFiles) {
            shaCache[file.path] = "0".repeat(40) // guaranteed different
          }

          // All files should be classified as changed and "downloaded"
          const originalResult = originalFetch(uniqueFiles)
          const optimizedResult = optimizedFetch(uniqueFiles, shaCache, [])

          const originalIds = new Set(originalResult.map((e) => e.id))
          const optimizedIds = new Set(optimizedResult.map((e) => e.id))

          expect(optimizedIds.size).toBe(originalIds.size)
          for (const id of originalIds) {
            expect(optimizedIds.has(id)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
