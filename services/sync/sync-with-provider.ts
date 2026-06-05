import type { SyncProvider, SyncSnapshot } from "./provider-types"
import { SyncProviderError, SETTINGS_FILENAME } from "./provider-types"
import { importFromCSV, exportToCSV } from "../csv-handler"
import { groupExpensesByDay, getFilenameForDay } from "../daily-file-manager"
import { computeContentHash } from "../hash-storage"
import {
  mergeExpenses,
  applyConflictResolutions,
  type MergeResult,
  type TrueConflict,
} from "../merge-engine"
import type { Expense } from "../../types/expense"
import { APP_CONFIG } from "../../constants/app-config"

export interface SyncWithProviderResult {
  success: boolean
  mergeResult?: MergeResult
  pendingConflicts?: TrueConflict[]
  error?: string
  errorCode?: string
  isInSync?: boolean
  isFirstSync?: boolean
}

export interface SyncWithProviderOptions {
  provider: SyncProvider
  localExpenses: Expense[]
  dirtyDays?: string[]
  deletedDays?: string[]
  conflictResolver?: (
    conflicts: TrueConflict[]
  ) => Promise<{ expenseId: string; choice: "local" | "remote" }[] | undefined>
}

export async function syncWithProvider(
  options: SyncWithProviderOptions
): Promise<SyncWithProviderResult> {
  const { provider, localExpenses, conflictResolver, dirtyDays, deletedDays } = options

  const filterPaths = buildFilterPaths(dirtyDays, deletedDays)

  let snapshot: SyncSnapshot | null
  try {
    snapshot = await provider.readSnapshot(filterPaths)
  } catch (error) {
    const formatted = formatError(error)
    return {
      success: false,
      error: formatted.message,
      errorCode: formatted.code,
      isFirstSync: false,
    }
  }

  if (!snapshot) {
    return { success: true, isFirstSync: true }
  }

  const remoteExpenses = parseExpensesFromSnapshot(snapshot)

  let mergeResult = mergeExpenses(localExpenses, remoteExpenses)

  const conflictOutcome = await resolveConflictsIfNeeded(mergeResult, conflictResolver)
  if (conflictOutcome.earlyReturn) return conflictOutcome.earlyReturn
  if (conflictOutcome.updatedResult) {
    mergeResult = conflictOutcome.updatedResult
  }

  const mergedSnapshot = buildSnapshot(mergeResult.merged, snapshot)

  if (!snapshotHasChanges(snapshot, mergedSnapshot)) {
    return {
      success: true,
      mergeResult,
      isInSync: true,
    }
  }

  const writeSnapshot = filterChangedFiles(snapshot, mergedSnapshot)

  try {
    await provider.writeSnapshot(writeSnapshot, snapshot.remoteRevision)
  } catch (error) {
    const formatted = formatError(error)
    return {
      success: false,
      mergeResult,
      error: formatted.message,
      errorCode: formatted.code,
    }
  }

  return {
    success: true,
    mergeResult,
  }
}

export async function firstTimeSync(
  provider: SyncProvider,
  localExpenses: Expense[]
): Promise<SyncWithProviderResult> {
  const existingSnapshot = await provider.readSnapshot()
  if (existingSnapshot) {
    const remoteExpenses = parseExpensesFromSnapshot(existingSnapshot)
    const allExpenses = [...remoteExpenses]
    const localMap = new Map(localExpenses.map((e) => [e.id, e]))
    const seenIds = new Set<string>()
    for (const expense of allExpenses) {
      seenIds.add(expense.id)
      const local = localMap.get(expense.id)
      if (local && local.updatedAt > expense.updatedAt) {
        Object.assign(expense, local)
      }
    }
    for (const expense of localExpenses) {
      if (!seenIds.has(expense.id)) {
        allExpenses.push(expense)
      }
    }
    const mergedSnapshot = buildSnapshot(allExpenses, existingSnapshot)
    const writeSnapshot = filterChangedFiles(existingSnapshot, mergedSnapshot)
    try {
      await provider.writeSnapshot(writeSnapshot, existingSnapshot.remoteRevision)
    } catch (error) {
      const formatted = formatError(error)
      return {
        success: false,
        error: formatted.message,
        errorCode: formatted.code,
        isFirstSync: true,
      }
    }
    return {
      success: true,
      isFirstSync: true,
    }
  }

  const snapshot = buildSnapshot(localExpenses, null)
  try {
    await provider.writeSnapshot(snapshot, null)
  } catch (error) {
    const formatted = formatError(error)
    return {
      success: false,
      error: formatted.message,
      errorCode: formatted.code,
      isFirstSync: true,
    }
  }
  return {
    success: true,
    isFirstSync: true,
  }
}

async function resolveConflictsIfNeeded(
  mergeResult: MergeResult,
  conflictResolver?: SyncWithProviderOptions["conflictResolver"]
): Promise<{
  earlyReturn?: SyncWithProviderResult
  updatedResult?: MergeResult
}> {
  if (mergeResult.trueConflicts.length === 0) {
    return {}
  }

  if (!conflictResolver) {
    return {
      earlyReturn: {
        success: false,
        mergeResult,
        pendingConflicts: mergeResult.trueConflicts,
        error: "Conflicts detected",
      },
    }
  }

  const resolutions = await conflictResolver(mergeResult.trueConflicts)
  if (!resolutions) {
    return {
      earlyReturn: {
        success: false,
        mergeResult,
        pendingConflicts: mergeResult.trueConflicts,
        error: "Conflict resolution cancelled",
      },
    }
  }

  const resolutionMap = new Map(resolutions.map((r) => [r.expenseId, r.choice]))
  const updated = applyConflictResolutions(mergeResult, resolutionMap)

  if (updated.trueConflicts.length > 0) {
    return {
      earlyReturn: {
        success: false,
        mergeResult: updated,
        pendingConflicts: updated.trueConflicts,
        error: "Not all conflicts were resolved",
      },
    }
  }

  return { updatedResult: updated }
}

function parseExpensesFromSnapshot(snapshot: SyncSnapshot): Expense[] {
  const all: Expense[] = []
  for (const [path, content] of Object.entries(snapshot.files)) {
    if (path === SETTINGS_FILENAME) continue
    try {
      const expenses = importFromCSV(content)
      all.push(...expenses)
    } catch {
      continue
    }
  }
  return all
}

function buildSnapshot(
  expenses: Expense[],
  existingSnapshot: SyncSnapshot | null
): SyncSnapshot {
  const grouped = groupExpensesByDay(expenses)
  const files: Record<string, string> = {}

  for (const [dayKey, dayExpenses] of grouped) {
    files[getFilenameForDay(dayKey)] = exportToCSV(dayExpenses)
  }

  if (existingSnapshot) {
    for (const [path, content] of Object.entries(existingSnapshot.files)) {
      if (path === SETTINGS_FILENAME && !files[path]) {
        files[path] = content
      }
    }
  }

  return {
    manifest: {
      version: 1,
      generatedAt: new Date().toISOString(),
      appVersion: APP_CONFIG.version,
      files: Object.entries(files).map(([path, content]) => ({
        path,
        hash: computeContentHash(content),
      })),
    },
    files,
    remoteRevision: existingSnapshot?.remoteRevision ?? null,
  }
}

function snapshotHasChanges(before: SyncSnapshot, after: SyncSnapshot): boolean {
  const skipPaths = new Set<string>([SETTINGS_FILENAME])
  const bKeys = Object.keys(before.files)
    .filter((k) => !skipPaths.has(k))
    .sort()
  const aKeys = Object.keys(after.files)
    .filter((k) => !skipPaths.has(k))
    .sort()
  if (bKeys.length !== aKeys.length) return true
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return true
    if (before.files[aKeys[i]] !== after.files[aKeys[i]]) return true
  }
  return false
}

function formatError(error: unknown): { message: string; code?: string } {
  if (error instanceof SyncProviderError) {
    return { message: error.message, code: error.code }
  }
  if (error instanceof Error) {
    return { message: error.message }
  }
  return { message: String(error) }
}

/**
 * Given the before and after snapshots, produce a minimal snapshot containing
 * only the files that actually differ — plus the settings file.
 *
 * This ensures that `writeSnapshot()` only uploads changed/new files, deletes
 * removed files, and skips untouched files entirely, reducing API calls on
 * successive syncs.
 */
function buildFilterPaths(
  dirtyDays?: string[],
  deletedDays?: string[]
): string[] | undefined {
  const allDays = new Set([...(dirtyDays ?? []), ...(deletedDays ?? [])])
  if (allDays.size === 0) return undefined
  return Array.from(allDays).map(getFilenameForDay)
}

function filterChangedFiles(before: SyncSnapshot, after: SyncSnapshot): SyncSnapshot {
  const files: Record<string, string> = {}

  for (const [path, content] of Object.entries(after.files)) {
    const oldContent = before.files[path]
    if (path === SETTINGS_FILENAME || oldContent !== content) {
      files[path] = content
    }
  }

  for (const path of Object.keys(before.files)) {
    if (!(path in after.files)) {
      files[path] = ""
    }
  }

  return {
    manifest: {
      version: after.manifest.version,
      generatedAt: after.manifest.generatedAt,
      appVersion: after.manifest.appVersion,
      files: Object.entries(files).map(([path, content]) => ({
        path,
        hash: computeContentHash(content),
      })),
    },
    files,
    remoteRevision: after.remoteRevision,
  }
}
