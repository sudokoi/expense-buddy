import fc from "fast-check"
import { Expense, ExpenseCategory } from "../../types/expense"
import { getLocalDayKey } from "../../utils/date"
import { groupExpensesByDay, getFilenameForDay } from "../daily-file-manager"

// =============================================================================
// Arbitrary Generators
// =============================================================================

// Generate a date string in YYYY-MM-DD format within a reasonable range
const dateStringArb = fc
  .integer({ min: 0, max: 365 * 3 }) // 3 years of days
  .map((daysOffset) => {
    const baseDate = new Date("2023-01-01")
    baseDate.setDate(baseDate.getDate() + daysOffset)
    return getLocalDayKey(baseDate.toISOString())
  })

// =============================================================================
// Helper Functions (mimicking sync-manager logic)
// =============================================================================

interface RemoteFile {
  name: string
  path: string
  dayKey: string
}

/**
 * Determine which files should be deleted based on local expenses and remote files
 * This mimics the logic in gitStyleSync
 */
function determineFilesToDelete(
  localExpenses: Expense[],
  remoteFiles: RemoteFile[]
): RemoteFile[] {
  // Group local expenses by day
  const groupedByDay = groupExpensesByDay(localExpenses)
  const localDayKeys = new Set(groupedByDay.keys())

  // Determine the local data range
  let oldestLocalDate: string | null = null
  let newestLocalDate: string | null = null

  for (const dayKey of localDayKeys) {
    if (!oldestLocalDate || dayKey < oldestLocalDate) {
      oldestLocalDate = dayKey
    }
    if (!newestLocalDate || dayKey > newestLocalDate) {
      newestLocalDate = dayKey
    }
  }

  // Build list of files to delete
  // IMPORTANT: Only delete files within our local date range (Requirement 5.4)
  const filesToDelete: RemoteFile[] = []
  for (const file of remoteFiles) {
    const isWithinLocalRange =
      oldestLocalDate &&
      newestLocalDate &&
      file.dayKey >= oldestLocalDate &&
      file.dayKey <= newestLocalDate

    if (!localDayKeys.has(file.dayKey) && isWithinLocalRange) {
      filesToDelete.push(file)
    }
  }

  return filesToDelete
}

/**
 * Check if a date is outside the local date range
 */
function isOutsideLocalRange(dayKey: string, localExpenses: Expense[]): boolean {
  const groupedByDay = groupExpensesByDay(localExpenses)
  const localDayKeys = Array.from(groupedByDay.keys())

  if (localDayKeys.length === 0) {
    return true // No local data, everything is "outside"
  }

  const sortedDays = localDayKeys.sort()
  const oldestLocalDate = sortedDays[0]
  const newestLocalDate = sortedDays[sortedDays.length - 1]

  return dayKey < oldestLocalDate || dayKey > newestLocalDate
}

// =============================================================================
// Property Tests
// =============================================================================

describe("No Out-of-Range Deletions", () => {
  it("remote files outside local date range SHALL NOT be deleted", () => {
    fc.assert(
      fc.property(
        // Generate local dates (a contiguous range)
        fc.array(dateStringArb, { minLength: 1, maxLength: 5 }).chain((localDates) => {
          // Generate remote dates that include some outside the local range
          const uniqueLocalDates = [...new Set(localDates)].sort()

          return fc.tuple(
            fc.constant(uniqueLocalDates),
            // Remote dates: some within range, some outside
            fc.array(dateStringArb, { minLength: 1, maxLength: 10 })
          )
        }),
        ([localDates, remoteDates]) => {
          // Create local expenses for local dates
          const localExpenses: Expense[] = localDates.flatMap((date, dateIdx) => [
            {
              id: `local-${dateIdx}`,
              amount: 100,
              category: "Food" as ExpenseCategory,
              note: "test",
              date,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ])

          // Create remote files for remote dates
          const uniqueRemoteDates = [...new Set(remoteDates)]
          const remoteFiles: RemoteFile[] = uniqueRemoteDates.map((date) => ({
            name: getFilenameForDay(date),
            path: getFilenameForDay(date),
            dayKey: date,
          }))

          // Determine which files would be deleted
          const filesToDelete = determineFilesToDelete(localExpenses, remoteFiles)

          // Verify: NO file outside the local range should be deleted
          for (const file of filesToDelete) {
            if (isOutsideLocalRange(file.dayKey, localExpenses)) {
              // This file is outside the local range but was marked for deletion - FAIL
              return false
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("remote files before oldest local date SHALL NOT be deleted", () => {
    fc.assert(
      fc.property(
        // Generate a range of local dates
        fc.integer({ min: 30, max: 100 }).chain((startOffset) =>
          fc.integer({ min: 1, max: 30 }).chain((rangeSize) =>
            fc.tuple(
              fc.constant(startOffset),
              fc.constant(rangeSize),
              // Number of remote files before the range
              fc.integer({ min: 1, max: 10 })
            )
          )
        ),
        ([startOffset, rangeSize, numRemoteFilesBefore]) => {
          const baseDate = new Date("2023-01-01")

          // Create local dates starting at startOffset
          const localDates: string[] = []
          for (let i = 0; i < rangeSize; i++) {
            const date = new Date(baseDate)
            date.setDate(date.getDate() + startOffset + i)
            localDates.push(getLocalDayKey(date.toISOString()))
          }

          // Create local expenses
          const localExpenses: Expense[] = localDates.map((date, idx) => ({
            id: `local-${idx}`,
            amount: 100,
            category: "Food" as ExpenseCategory,
            note: "test",
            date,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }))

          // Create remote files BEFORE the local range
          const remoteDates: string[] = []
          for (let i = 0; i < numRemoteFilesBefore; i++) {
            const date = new Date(baseDate)
            date.setDate(date.getDate() + startOffset - 1 - i) // Before the range
            remoteDates.push(getLocalDayKey(date.toISOString()))
          }

          const remoteFiles: RemoteFile[] = remoteDates.map((date) => ({
            name: getFilenameForDay(date),
            path: getFilenameForDay(date),
            dayKey: date,
          }))

          // Determine which files would be deleted
          const filesToDelete = determineFilesToDelete(localExpenses, remoteFiles)

          // None of the remote files (all before local range) should be deleted
          return filesToDelete.length === 0
        }
      ),
      { numRuns: 100 }
    )
  })

  it("remote files after newest local date SHALL NOT be deleted", () => {
    fc.assert(
      fc.property(
        // Generate a range of local dates
        fc.integer({ min: 0, max: 50 }).chain((startOffset) =>
          fc.integer({ min: 1, max: 30 }).chain((rangeSize) =>
            fc.tuple(
              fc.constant(startOffset),
              fc.constant(rangeSize),
              // Number of remote files after the range
              fc.integer({ min: 1, max: 10 })
            )
          )
        ),
        ([startOffset, rangeSize, numRemoteFilesAfter]) => {
          const baseDate = new Date("2023-01-01")

          // Create local dates starting at startOffset
          const localDates: string[] = []
          for (let i = 0; i < rangeSize; i++) {
            const date = new Date(baseDate)
            date.setDate(date.getDate() + startOffset + i)
            localDates.push(getLocalDayKey(date.toISOString()))
          }

          // Create local expenses
          const localExpenses: Expense[] = localDates.map((date, idx) => ({
            id: `local-${idx}`,
            amount: 100,
            category: "Food" as ExpenseCategory,
            note: "test",
            date,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }))

          // Create remote files AFTER the local range
          const remoteDates: string[] = []
          for (let i = 0; i < numRemoteFilesAfter; i++) {
            const date = new Date(baseDate)
            date.setDate(date.getDate() + startOffset + rangeSize + i) // After the range
            remoteDates.push(getLocalDayKey(date.toISOString()))
          }

          const remoteFiles: RemoteFile[] = remoteDates.map((date) => ({
            name: getFilenameForDay(date),
            path: getFilenameForDay(date),
            dayKey: date,
          }))

          // Determine which files would be deleted
          const filesToDelete = determineFilesToDelete(localExpenses, remoteFiles)

          // None of the remote files (all after local range) should be deleted
          return filesToDelete.length === 0
        }
      ),
      { numRuns: 100 }
    )
  })

  it("only remote files within local range AND not in local data SHALL be deleted", () => {
    fc.assert(
      fc.property(
        // Generate local dates with some gaps
        fc
          .array(fc.integer({ min: 0, max: 30 }), { minLength: 2, maxLength: 10 })
          .map((offsets) => [...new Set(offsets)].sort((a, b) => a - b)),
        (localOffsets) => {
          const baseDate = new Date("2023-01-01")

          // Create local dates from offsets
          const localDates = localOffsets.map((offset) => {
            const date = new Date(baseDate)
            date.setDate(date.getDate() + offset)
            return getLocalDayKey(date.toISOString())
          })

          // Create local expenses
          const localExpenses: Expense[] = localDates.map((date, idx) => ({
            id: `local-${idx}`,
            amount: 100,
            category: "Food" as ExpenseCategory,
            note: "test",
            date,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }))

          // Determine local range
          const sortedLocalDates = [...localDates].sort()
          const oldestLocal = sortedLocalDates[0]
          const newestLocal = sortedLocalDates[sortedLocalDates.length - 1]

          // Create remote files: some within range (gaps), some outside
          const remoteDates: string[] = []

          // Add dates within the range but not in local (gaps)
          const minOffset = localOffsets[0]
          const maxOffset = localOffsets[localOffsets.length - 1]
          for (let offset = minOffset; offset <= maxOffset; offset++) {
            if (!localOffsets.includes(offset)) {
              const date = new Date(baseDate)
              date.setDate(date.getDate() + offset)
              remoteDates.push(getLocalDayKey(date.toISOString()))
            }
          }

          // Add dates outside the range
          const beforeDate = new Date(baseDate)
          beforeDate.setDate(beforeDate.getDate() + minOffset - 5)
          remoteDates.push(getLocalDayKey(beforeDate.toISOString()))

          const afterDate = new Date(baseDate)
          afterDate.setDate(afterDate.getDate() + maxOffset + 5)
          remoteDates.push(getLocalDayKey(afterDate.toISOString()))

          const remoteFiles: RemoteFile[] = remoteDates.map((date) => ({
            name: getFilenameForDay(date),
            path: getFilenameForDay(date),
            dayKey: date,
          }))

          // Determine which files would be deleted
          const filesToDelete = determineFilesToDelete(localExpenses, remoteFiles)

          // Verify each deleted file:
          // 1. Is within the local range
          // 2. Is not in local data
          for (const file of filesToDelete) {
            const isWithinRange = file.dayKey >= oldestLocal && file.dayKey <= newestLocal
            const isInLocalData = localDates.includes(file.dayKey)

            if (!isWithinRange || isInLocalData) {
              return false
            }
          }

          // Also verify that files outside range are NOT deleted
          for (const file of remoteFiles) {
            const isOutsideRange = file.dayKey < oldestLocal || file.dayKey > newestLocal
            const wasDeleted = filesToDelete.some((f) => f.dayKey === file.dayKey)

            if (isOutsideRange && wasDeleted) {
              return false
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("empty local expenses SHALL result in no deletions", () => {
    fc.assert(
      fc.property(
        fc.array(dateStringArb, { minLength: 1, maxLength: 10 }),
        (remoteDates) => {
          const localExpenses: Expense[] = []

          const uniqueRemoteDates = [...new Set(remoteDates)]
          const remoteFiles: RemoteFile[] = uniqueRemoteDates.map((date) => ({
            name: getFilenameForDay(date),
            path: getFilenameForDay(date),
            dayKey: date,
          }))

          // With no local expenses, no files should be deleted
          const filesToDelete = determineFilesToDelete(localExpenses, remoteFiles)

          return filesToDelete.length === 0
        }
      ),
      { numRuns: 100 }
    )
  })
})
