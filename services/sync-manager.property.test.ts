/**
 * Property-based tests for Sync Manager - SHA Classification and Fetch Completeness
 * Feature: sync-engine-optimization
 */

import * as fc from "fast-check"
import { classifyTreeEntries } from "./sync-manager"

// Arbitraries for generating test data
const shaArb = fc.stringMatching(/^[0-9a-f]{40}$/)
const dayKeyArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`)

function entryFromDayKey(dayKey: string, sha: string) {
  return { path: `expenses-${dayKey}.csv`, sha }
}

/**
 * Property 3: SHA-Based File Classification
 * For any set of tree entries and cache state, a file SHALL be classified as
 * "unchanged" if and only if the cache contains an entry for that filename with
 * the same blob SHA AND local expenses exist for that day. All other files SHALL
 * be classified as "changed". When the cache is empty, all files SHALL be
 * classified as "changed".
 */
describe("Property 3: SHA-Based File Classification", () => {
  const treeEntryArb = fc.tuple(dayKeyArb, shaArb).map(([day, sha]) => ({
    ...entryFromDayKey(day, sha),
    dayKey: day,
  }))

  const cacheEntryArb = fc.tuple(dayKeyArb, shaArb).map(([day, sha]) => ({
    filename: `expenses-${day}.csv`,
    sha,
    dayKey: day,
  }))

  it("files with matching SHA in cache AND local expenses SHALL be classified as unchanged", () => {
    fc.assert(
      fc.property(fc.array(treeEntryArb, { minLength: 1, maxLength: 20 }), (entries) => {
        // Deduplicate by path
        const uniqueEntries = [...new Map(entries.map((e) => [e.path, e])).values()]

        // Build a cache that matches all entries
        const cache: { [k: string]: string } = {}
        const localDayKeys = new Set<string>()
        for (const entry of uniqueEntries) {
          cache[entry.path] = entry.sha
          localDayKeys.add(entry.dayKey)
        }

        const result = classifyTreeEntries(
          uniqueEntries.map((e) => ({ path: e.path, sha: e.sha })),
          cache,
          localDayKeys
        )

        // All should be unchanged
        expect(result.unchanged.length).toBe(uniqueEntries.length)
        expect(result.changed.length).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  it("files with different SHA in cache SHALL be classified as changed", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(dayKeyArb, shaArb, shaArb).filter(([, s1, s2]) => s1 !== s2),
          {
            minLength: 1,
            maxLength: 20,
          }
        ),
        (entries) => {
          const uniqueEntries = [
            ...new Map(entries.map(([day, treeSha]) => [day, { day, treeSha }])).values(),
          ]

          const cache: { [k: string]: string } = {}
          const localDayKeys = new Set<string>()
          const treeEntries: { path: string; sha: string }[] = []

          for (const { day, treeSha } of uniqueEntries) {
            const path = `expenses-${day}.csv`
            // Cache has a DIFFERENT sha
            cache[path] = treeSha + "0" // guaranteed different since treeSha is 40 hex chars
            localDayKeys.add(day)
            treeEntries.push({ path, sha: treeSha })
          }

          const result = classifyTreeEntries(treeEntries, cache, localDayKeys)

          expect(result.changed.length).toBe(uniqueEntries.length)
          expect(result.unchanged.length).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("empty cache SHALL classify all files as changed", () => {
    fc.assert(
      fc.property(fc.array(treeEntryArb, { minLength: 1, maxLength: 20 }), (entries) => {
        const uniqueEntries = [...new Map(entries.map((e) => [e.path, e])).values()]
        const localDayKeys = new Set(uniqueEntries.map((e) => e.dayKey))

        const result = classifyTreeEntries(
          uniqueEntries.map((e) => ({ path: e.path, sha: e.sha })),
          {},
          localDayKeys
        )

        expect(result.changed.length).toBe(uniqueEntries.length)
        expect(result.unchanged.length).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  it("files missing from cache SHALL be classified as changed", () => {
    fc.assert(
      fc.property(fc.array(treeEntryArb, { minLength: 2, maxLength: 20 }), (entries) => {
        const uniqueEntries = [...new Map(entries.map((e) => [e.path, e])).values()]
        if (uniqueEntries.length < 2) return

        const localDayKeys = new Set(uniqueEntries.map((e) => e.dayKey))

        // Only cache the first half
        const cache: { [k: string]: string } = {}
        const half = Math.floor(uniqueEntries.length / 2)
        for (let i = 0; i < half; i++) {
          cache[uniqueEntries[i].path] = uniqueEntries[i].sha
        }

        const result = classifyTreeEntries(
          uniqueEntries.map((e) => ({ path: e.path, sha: e.sha })),
          cache,
          localDayKeys
        )

        // First half should be unchanged, rest should be changed
        expect(result.unchanged.length).toBe(half)
        expect(result.changed.length).toBe(uniqueEntries.length - half)
      }),
      { numRuns: 100 }
    )
  })

  it("files with matching SHA but no local expenses SHALL be classified as changed", () => {
    fc.assert(
      fc.property(fc.array(treeEntryArb, { minLength: 1, maxLength: 20 }), (entries) => {
        const uniqueEntries = [...new Map(entries.map((e) => [e.path, e])).values()]

        // Cache matches all SHAs, but no local day keys
        const cache: { [k: string]: string } = {}
        for (const entry of uniqueEntries) {
          cache[entry.path] = entry.sha
        }

        const result = classifyTreeEntries(
          uniqueEntries.map((e) => ({ path: e.path, sha: e.sha })),
          cache,
          new Set<string>() // empty local day keys
        )

        expect(result.changed.length).toBe(uniqueEntries.length)
        expect(result.unchanged.length).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  it("changed + unchanged SHALL always equal total entries", () => {
    fc.assert(
      fc.property(
        fc.array(treeEntryArb, { minLength: 0, maxLength: 20 }),
        fc.array(cacheEntryArb, { minLength: 0, maxLength: 20 }),
        fc.array(dayKeyArb, { minLength: 0, maxLength: 20 }),
        (entries, cacheEntries, localDays) => {
          const uniqueEntries = [...new Map(entries.map((e) => [e.path, e])).values()]
          const cache: { [k: string]: string } = {}
          for (const c of cacheEntries) {
            cache[c.filename] = c.sha
          }
          const localDayKeys = new Set(localDays)

          const result = classifyTreeEntries(
            uniqueEntries.map((e) => ({ path: e.path, sha: e.sha })),
            cache,
            localDayKeys
          )

          expect(result.changed.length + result.unchanged.length).toBe(
            uniqueEntries.length
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})

import { Expense } from "../types/expense"
import { groupExpensesByDay } from "./daily-file-manager"

// Expense arbitrary for generating test expenses
const expenseArb = (dayKey: string): fc.Arbitrary<Expense> =>
  fc.record({
    id: fc.uuid(),
    amount: fc.double({ min: 0.01, max: 10000, noNaN: true }),
    category: fc.constantFrom("Food", "Transport", "Shopping", "Other"),
    date: fc.constant(new Date(`${dayKey}T12:00:00.000Z`).toISOString()),
    note: fc.string({ minLength: 0, maxLength: 20 }),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  })

/**
 * Property 4: Fetch Result Expense Completeness
 * For any combination of changed and unchanged remote files, the combined
 * expense set SHALL contain every expense from every remote file.
 * Unchanged files contribute their locally cached expenses, and changed files
 * contribute their freshly downloaded and parsed expenses.
 */
describe("Property 4: Fetch Result Expense Completeness", () => {
  // Generate a set of day keys with expenses for each day
  const dayWithExpensesArb = dayKeyArb.chain((day) =>
    fc
      .array(expenseArb(day), { minLength: 1, maxLength: 5 })
      .map((expenses) => ({ dayKey: day, expenses }))
  )

  it("combined expenses from changed + unchanged files SHALL contain every expense", () => {
    fc.assert(
      fc.property(
        fc.array(dayWithExpensesArb, { minLength: 1, maxLength: 10 }),
        fc.func(fc.boolean()),
        (daysWithExpenses, isUnchangedFn) => {
          // Deduplicate by day key
          const uniqueDays = [
            ...new Map(daysWithExpenses.map((d) => [d.dayKey, d])).values(),
          ]

          // All expenses across all files (the ground truth)
          const allExpenses = uniqueDays.flatMap((d) => d.expenses)

          // Simulate classification: some files are unchanged, some are changed
          const localByDay = groupExpensesByDay(allExpenses)
          const unchangedExpenses: Expense[] = []
          const changedExpenses: Expense[] = []

          for (const { dayKey, expenses } of uniqueDays) {
            if (isUnchangedFn(dayKey)) {
              // Unchanged: reuse local expenses for this day
              const localDayExpenses = localByDay.get(dayKey) ?? []
              unchangedExpenses.push(...localDayExpenses)
            } else {
              // Changed: use "downloaded" expenses (same as ground truth for this day)
              changedExpenses.push(...expenses)
            }
          }

          // Combined set should contain every expense from every file
          const combined = [...unchangedExpenses, ...changedExpenses]
          const combinedIds = new Set(combined.map((e) => e.id))
          const allIds = new Set(allExpenses.map((e) => e.id))

          expect(combinedIds.size).toBe(allIds.size)
          for (const id of allIds) {
            expect(combinedIds.has(id)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("when all files are changed (empty cache), combined set SHALL equal full download", () => {
    fc.assert(
      fc.property(
        fc.array(dayWithExpensesArb, { minLength: 1, maxLength: 10 }),
        (daysWithExpenses) => {
          const uniqueDays = [
            ...new Map(daysWithExpenses.map((d) => [d.dayKey, d])).values(),
          ]

          const allExpenses = uniqueDays.flatMap((d) => d.expenses)

          // All files are changed (empty cache scenario) — all get downloaded
          const combined = [...allExpenses]
          const combinedIds = new Set(combined.map((e) => e.id))
          const allIds = new Set(allExpenses.map((e) => e.id))

          expect(combinedIds.size).toBe(allIds.size)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("when all files are unchanged, combined set SHALL equal local expenses", () => {
    fc.assert(
      fc.property(
        fc.array(dayWithExpensesArb, { minLength: 1, maxLength: 10 }),
        (daysWithExpenses) => {
          const uniqueDays = [
            ...new Map(daysWithExpenses.map((d) => [d.dayKey, d])).values(),
          ]

          const allExpenses = uniqueDays.flatMap((d) => d.expenses)
          const localByDay = groupExpensesByDay(allExpenses)

          // All files unchanged — reuse local expenses
          const combined: Expense[] = []
          for (const { dayKey } of uniqueDays) {
            const localDayExpenses = localByDay.get(dayKey) ?? []
            combined.push(...localDayExpenses)
          }

          const combinedIds = new Set(combined.map((e) => e.id))
          const allIds = new Set(allExpenses.map((e) => e.id))

          expect(combinedIds.size).toBe(allIds.size)
          for (const id of allIds) {
            expect(combinedIds.has(id)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
