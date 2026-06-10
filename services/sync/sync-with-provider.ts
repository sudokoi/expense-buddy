import type { SyncProvider, SyncSnapshot, RemoteRevision } from "./provider-types"
import { SyncProviderError, SETTINGS_FILENAME } from "./provider-types"
import { importFromCSV, exportToCSV } from "../csv-handler"
import {
  groupExpensesByDay,
  getFilenameForDay,
  getDayKeyFromFilename,
} from "../daily-file-manager"
import { computeContentHash } from "../hash-storage"
import {
  mergeExpenses,
  applyConflictResolutions,
  type MergeResult,
  type TrueConflict,
} from "../merge-engine"
import type { Expense } from "../../types/expense"
import type { AppSettings } from "../settings-manager"
import {
  hydrateSettingsFromJson,
  computeSettingsHash,
  DEFAULT_SETTINGS_HASH,
} from "../settings-manager"
import { APP_CONFIG } from "../../constants/app-config"
import { logAsync } from "../logger"

export interface SyncWithProviderResult {
  success: boolean
  mergeResult?: MergeResult
  mergedSettings?: AppSettings
  pendingConflicts?: TrueConflict[]
  error?: string
  errorCode?: string
  isInSync?: boolean
  isFirstSync?: boolean
}

export interface SyncWithProviderOptions {
  provider: SyncProvider
  localExpenses: Expense[]
  localSettings?: AppSettings
  syncSettingsEnabled?: boolean
  dirtyDays?: string[]
  deletedDays?: string[]
  conflictResolver?: (
    conflicts: TrueConflict[]
  ) => Promise<{ expenseId: string; choice: "local" | "remote" }[] | undefined>
}

export async function syncWithProvider(
  options: SyncWithProviderOptions
): Promise<SyncWithProviderResult> {
  const {
    provider,
    localExpenses,
    localSettings,
    syncSettingsEnabled,
    dirtyDays = [],
    deletedDays = [],
    conflictResolver,
  } = options

  logAsync(
    "INFO",
    "SYNC_CORE",
    `SYNC_WITH_PROVIDER localCount=${localExpenses.length} syncSettings=${syncSettingsEnabled}`
  )

  let snapshot: SyncSnapshot | null
  try {
    snapshot = await provider.readSnapshot()
  } catch (error) {
    const formatted = formatError(error)
    logAsync(
      "ERROR",
      "SYNC_CORE",
      `READ_SNAPSHOT_FAILED error=${formatted.message} code=${formatted.code ?? "none"}`
    )
    return {
      success: false,
      error: formatted.message,
      errorCode: formatted.code,
      isFirstSync: false,
    }
  }

  if (!snapshot) {
    logAsync("INFO", "SYNC_CORE", "FIRST_TIME_SYNC noRemoteData")
    return { success: true, isFirstSync: true }
  }

  const remoteExpenses = parseExpensesFromSnapshot(snapshot)
  const remoteSettings = parseSettingsFromSnapshot(snapshot)

  logAsync(
    "INFO",
    "SYNC_CORE",
    `PARSED_REMOTE expenses=${remoteExpenses.length} hasSettings=${remoteSettings !== null}`
  )

  let mergeResult = mergeExpenses(localExpenses, remoteExpenses)
  let mergedSettings: AppSettings | undefined

  logAsync(
    "INFO",
    "SYNC_CORE",
    `MERGE_RESULT addedLocal=${mergeResult.addedFromLocal.length} updatedLocal=${mergeResult.updatedFromLocal.length} addedRemote=${mergeResult.addedFromRemote.length} updatedRemote=${mergeResult.updatedFromRemote.length} conflicts=${mergeResult.trueConflicts.length}`
  )

  const conflictOutcome = await resolveConflictsIfNeeded(mergeResult, conflictResolver)
  if (conflictOutcome.earlyReturn) return conflictOutcome.earlyReturn
  if (conflictOutcome.updatedResult) {
    mergeResult = conflictOutcome.updatedResult
  }

  if (syncSettingsEnabled && localSettings) {
    mergedSettings = remoteSettings
      ? mergeSettings(localSettings, remoteSettings)
      : localSettings
  }

  const mergedSnapshot = buildSnapshot(
    mergeResult.merged,
    snapshot,
    mergedSettings,
    syncSettingsEnabled
  )

  if (!snapshotHasChanges(snapshot, mergedSnapshot, syncSettingsEnabled)) {
    logAsync("INFO", "SYNC_CORE", "IN_SYNC noChangesDetected")
    return {
      success: true,
      mergeResult,
      mergedSettings,
      isInSync: true,
    }
  }

  // UPLOAD SCOPE: only this device's changed days (dirty ∪ deleted),
  // intersected with files that actually differ from remote, PLUS any files
  // whose content changed due to format differences (e.g. v3→v4 CSV format
  // conversion). Fetch scope (the full remote merged above) and upload scope
  // are two independent sets and are never collapsed into a single filter.
  // Remote-only changes are already in mergeResult.merged; we do NOT re-upload
  // remote days we did not touch.
  const uploadSnapshot = buildUploadSnapshot({
    before: snapshot,
    mergedFull: mergedSnapshot,
    dirtyDays,
    deletedDays,
    syncSettingsEnabled,
  })

  const uploadFileCount = Object.keys(uploadSnapshot.files).length

  if (uploadFileCount === 0) {
    // The merge only pulled remote changes (nothing of ours to push). Return the
    // merged result so the orchestrator updates local state WITHOUT writing remote.
    logAsync("INFO", "SYNC_CORE", "UPLOAD_EMPTY pullOnly leavingRemoteUnchanged")
    return {
      success: true,
      mergeResult,
      mergedSettings,
    }
  }

  logAsync("INFO", "SYNC_CORE", `WRITE_SNAPSHOT files=${uploadFileCount}`)

  try {
    await provider.writeSnapshot(uploadSnapshot, snapshot.remoteRevision)
    logAsync("INFO", "SYNC_CORE", "WRITE_SNAPSHOT_SUCCESS")
  } catch (error) {
    const formatted = formatError(error)
    logAsync(
      "ERROR",
      "SYNC_CORE",
      `WRITE_SNAPSHOT_FAILED error=${formatted.message} code=${formatted.code ?? "none"}`
    )
    return {
      success: false,
      mergeResult,
      mergedSettings,
      error: formatted.message,
      errorCode: formatted.code,
    }
  }

  return {
    success: true,
    mergeResult,
    mergedSettings,
  }
}

export async function firstTimeSync(
  provider: SyncProvider,
  localExpenses: Expense[],
  localSettings?: AppSettings,
  syncSettingsEnabled?: boolean
): Promise<SyncWithProviderResult> {
  logAsync(
    "INFO",
    "SYNC_CORE",
    `FIRST_TIME_SYNC_START localCount=${localExpenses.length} syncSettings=${syncSettingsEnabled}`
  )

  const existingSnapshot = await provider.readSnapshot()
  if (existingSnapshot) {
    logAsync("INFO", "SYNC_CORE", "FIRST_TIME_SYNC hasRemoteSnapshot merging")
    const remoteExpenses = parseExpensesFromSnapshot(existingSnapshot)
    const remoteSettings = parseSettingsFromSnapshot(existingSnapshot)

    let mergedSettings: AppSettings | undefined
    if (syncSettingsEnabled && localSettings) {
      mergedSettings = remoteSettings
        ? mergeSettings(localSettings, remoteSettings)
        : localSettings
    }

    // Both sides have data: merge through the shared tombstone- and
    // conflict-aware engine. There is NO last-writer-wins fallback: if the
    // merge engine throws, the sync fails entirely rather than degrading to a
    // lossy updatedAt string compare (Requirement 5.6).
    let mergeResult: MergeResult
    try {
      mergeResult = mergeExpenses(localExpenses, remoteExpenses)
    } catch (error) {
      const formatted = formatError(error)
      logAsync(
        "ERROR",
        "SYNC_CORE",
        `FIRST_TIME_SYNC_MERGE_ENGINE_FAILED error=${formatted.message} code=${formatted.code ?? "none"}`
      )
      return {
        success: false,
        error: formatted.message,
        errorCode: formatted.code,
        isFirstSync: true,
      }
    }

    logAsync(
      "INFO",
      "SYNC_CORE",
      `FIRST_TIME_SYNC_MERGE addedLocal=${mergeResult.addedFromLocal.length} updatedLocal=${mergeResult.updatedFromLocal.length} addedRemote=${mergeResult.addedFromRemote.length} updatedRemote=${mergeResult.updatedFromRemote.length} conflicts=${mergeResult.trueConflicts.length}`
    )

    // On a fresh install, remote-only history (all older than the read-only
    // window) is restored here. This is MERGE, not authoring — the read-only
    // guard is intentionally NOT consulted.
    const mergedSnapshot = buildSnapshot(
      mergeResult.merged,
      existingSnapshot,
      mergedSettings,
      syncSettingsEnabled
    )
    const writeSnapshot = filterChangedFiles(existingSnapshot, mergedSnapshot)

    if (Object.keys(writeSnapshot.files).length > 0) {
      logAsync(
        "INFO",
        "SYNC_CORE",
        `FIRST_TIME_SYNC writing merged files=${Object.keys(writeSnapshot.files).length}`
      )
      try {
        await provider.writeSnapshot(writeSnapshot, existingSnapshot.remoteRevision)
        logAsync("INFO", "SYNC_CORE", "FIRST_TIME_SYNC_MERGE_WRITE_SUCCESS")
      } catch (error) {
        const formatted = formatError(error)
        logAsync(
          "ERROR",
          "SYNC_CORE",
          `FIRST_TIME_SYNC_MERGE_WRITE_FAILED error=${formatted.message} code=${formatted.code ?? "none"}`
        )
        return {
          success: false,
          mergeResult,
          mergedSettings,
          error: formatted.message,
          errorCode: formatted.code,
          isFirstSync: true,
        }
      }
    } else {
      logAsync("INFO", "SYNC_CORE", "FIRST_TIME_SYNC_NO_UPLOAD mergedEqualsRemote")
    }

    // Return mergeResult (including trueConflicts) so the orchestrator can
    // replace local state with the merged set and surface any true conflicts
    // through the same conflict-resolution path as a normal sync.
    return {
      success: true,
      isFirstSync: true,
      mergeResult,
      mergedSettings,
      pendingConflicts:
        mergeResult.trueConflicts.length > 0 ? mergeResult.trueConflicts : undefined,
    }
  }

  const mergedSettings = syncSettingsEnabled && localSettings ? localSettings : undefined
  const snapshot = buildSnapshot(localExpenses, null, mergedSettings, syncSettingsEnabled)

  // Nothing to initialize (no local expenses and no settings to sync): skip the
  // remote write entirely rather than creating an empty snapshot on the remote.
  if (Object.keys(snapshot.files).length === 0) {
    logAsync("INFO", "SYNC_CORE", "FIRST_TIME_SYNC_NO_INITIAL_DATA skippingWrite")
    return { success: true, isFirstSync: true }
  }

  logAsync(
    "INFO",
    "SYNC_CORE",
    `FIRST_TIME_SYNC writing initial snapshot files=${Object.keys(snapshot.files).length}`
  )
  try {
    await provider.writeSnapshot(snapshot, null)
    logAsync("INFO", "SYNC_CORE", "FIRST_TIME_SYNC_INITIAL_WRITE_SUCCESS")
  } catch (error) {
    const formatted = formatError(error)
    logAsync(
      "ERROR",
      "SYNC_CORE",
      `FIRST_TIME_SYNC_INITIAL_WRITE_FAILED error=${formatted.message} code=${formatted.code ?? "none"}`
    )
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

/**
 * Merge local and remote settings with data-loss protection.
 *
 * Strategy:
 *  1. If either side is pristine (matches DEFAULT_SETTINGS hash), prefer
 *     the other — this prevents a fresh install or cleared app-data from
 *     overwriting the user's real remote settings (the root cause of the
 *     v4.0.0 data-loss bug).
 *  2. If both sides have real user customizations, use last-writer-wins
 *     by `updatedAt` timestamp, matching the semantics of expense and
 *     category merges elsewhere in the sync layer.
 *  3. If content is identical (same hash), return local as-is to avoid
 *     unnecessary writes downstream.
 */
function mergeSettings(local: AppSettings, remote: AppSettings): AppSettings {
  const localHash = computeSettingsHash(local)
  const remoteHash = computeSettingsHash(remote)

  if (localHash === remoteHash) return local

  if (remoteHash === DEFAULT_SETTINGS_HASH) return local
  if (localHash === DEFAULT_SETTINGS_HASH) return remote

  return new Date(local.updatedAt) >= new Date(remote.updatedAt) ? local : remote
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

function parseSettingsFromSnapshot(snapshot: SyncSnapshot): AppSettings | null {
  const content = snapshot.files[SETTINGS_FILENAME]
  if (!content) return null
  try {
    return hydrateSettingsFromJson(JSON.parse(content))
  } catch {
    return null
  }
}

function buildSnapshot(
  expenses: Expense[],
  existingSnapshot: SyncSnapshot | null,
  mergedSettings?: AppSettings,
  syncSettingsEnabled?: boolean
): SyncSnapshot {
  const grouped = groupExpensesByDay(expenses)
  const files: Record<string, string> = {}

  for (const [dayKey, dayExpenses] of grouped) {
    files[getFilenameForDay(dayKey)] = exportToCSV(dayExpenses)
  }

  if (syncSettingsEnabled && mergedSettings) {
    files[SETTINGS_FILENAME] = JSON.stringify(mergedSettings)
  } else if (existingSnapshot) {
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

function snapshotHasChanges(
  before: SyncSnapshot,
  after: SyncSnapshot,
  syncSettingsEnabled?: boolean
): boolean {
  const skipPaths = new Set<string>()
  if (!syncSettingsEnabled) {
    skipPaths.add(SETTINGS_FILENAME)
  }
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
 * Build the upload-scoped snapshot. This is the explicit upload-scoping function
 * that replaces the misuse of `filterChangedFiles` for upload selection in the
 * normal sync cycle.
 *
 * Fetch scope (full remote) and upload scope (this device's dirty/deleted days)
 * are two independent sets and must never be collapsed. This function emits:
 *  - upserts only for dirty-day files whose merged content differs from `before`
 *  - empty-string deletion markers for deleted/empty dirty-day files present in
 *    `before` (the provider interprets "" as delete)
 *  - the settings file only when settings sync is on AND it changed
 *
 * Remote-only day files this device never touched are intentionally excluded:
 * they are already carried into the merged local state and must never be
 * scheduled for deletion.
 */
function buildUploadSnapshot(args: {
  before: SyncSnapshot
  mergedFull: SyncSnapshot
  dirtyDays: string[]
  deletedDays: string[]
  syncSettingsEnabled?: boolean
}): SyncSnapshot {
  const { before, mergedFull, dirtyDays, deletedDays, syncSettingsEnabled } = args

  // The set of day-file paths THIS device changed.
  const dirtyPaths = new Set(dirtyDays.map(getFilenameForDay))
  const deletedPaths = new Set(deletedDays.map(getFilenameForDay))

  const files: Record<string, string> = {}

  // Upserts: only dirty day files whose content actually differs from remote.
  for (const path of dirtyPaths) {
    const next = mergedFull.files[path]
    if (next !== undefined && next !== before.files[path]) {
      files[path] = next
    }
  }

  // Deletions: dirty/deleted day files now empty/absent -> empty-string marker.
  for (const path of deletedPaths) {
    const nextContent = mergedFull.files[path]
    const stillPresent = nextContent !== undefined && nextContent.length > 0
    if (!stillPresent && before.files[path] !== undefined) {
      files[path] = "" // provider interprets "" as delete
    }
  }

  // Settings file is uploaded only when settings sync is on and it changed.
  if (syncSettingsEnabled) {
    const next = mergedFull.files[SETTINGS_FILENAME]
    if (next !== undefined && next !== before.files[SETTINGS_FILENAME]) {
      files[SETTINGS_FILENAME] = next
    }
  }

  // FORMAT CONVERSION: include files whose content changed between the remote
  // and merged snapshot purely due to format differences (e.g. v3→v4 CSV
  // format). Do NOT override dirty-day files — those already carry actual data
  // changes from this device. Adding them here ensures every sync cycle
  // converts a batch until all remote files use the current format.
  const formatChanges = filterChangedFiles(before, mergedFull)
  for (const [path, content] of Object.entries(formatChanges.files)) {
    if (!(path in files)) {
      files[path] = content
    }
  }

  // The covered day range is derived from the FULL merged data (every day file
  // in mergedFull), NOT the changed-file subset, so a provider's deletion guard
  // can correctly tell an in-range explicit deletion from an out-of-range one.
  return withManifest(
    files,
    mergedFull.remoteRevision,
    computeCoveredDayRange(mergedFull)
  )
}

/**
 * Compute the `yyyy-MM-dd` day-key span covered by all day files in a snapshot.
 * Returns null when the snapshot carries no day files (settings-only).
 */
function computeCoveredDayRange(
  snapshot: SyncSnapshot
): { oldest: string; newest: string } | null {
  let oldest: string | null = null
  let newest: string | null = null
  for (const path of Object.keys(snapshot.files)) {
    if (path === SETTINGS_FILENAME) continue
    const dayKey = getDayKeyFromFilename(path)
    if (dayKey === null) continue
    if (oldest === null || dayKey < oldest) oldest = dayKey
    if (newest === null || dayKey > newest) newest = dayKey
  }
  return oldest !== null && newest !== null ? { oldest, newest } : null
}

/**
 * Wrap a `path -> content` file map in a SyncSnapshot with a freshly computed
 * manifest, carrying the supplied remote revision.
 */
function withManifest(
  files: Record<string, string>,
  remoteRevision: RemoteRevision | null,
  coveredDayRange?: { oldest: string; newest: string } | null
): SyncSnapshot {
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
    remoteRevision,
    coveredDayRange: coveredDayRange ?? null,
  }
}

/**
 * Given the before and after snapshots, produce a minimal snapshot containing
 * only the files that actually differ — plus the settings file.
 *
 * This ensures that `writeSnapshot()` only uploads changed/new files, deletes
 * removed files, and skips untouched files entirely, reducing API calls on
 * successive syncs.
 */
function filterChangedFiles(before: SyncSnapshot, after: SyncSnapshot): SyncSnapshot {
  const files: Record<string, string> = {}

  for (const [path, content] of Object.entries(after.files)) {
    if (path === SETTINGS_FILENAME || before.files[path] !== content) {
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
