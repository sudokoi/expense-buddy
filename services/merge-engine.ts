/**
 * MergeEngine - Git-style merge logic for expenses
 *
 * Implements a fetch-merge-push workflow similar to git, where:
 * 1. Local and remote expenses are merged by ID
 * 2. Conflicts are resolved by timestamp (newer wins)
 * 3. True conflicts (equal timestamps) require user intervention
 * 4. Deletions are handled via soft delete (deletedAt field)
 */

import { Expense } from "../types/expense"

/**
 * Represents an automatically resolved conflict where timestamps determined the winner
 */
export interface AutoResolvedConflict {
  expenseId: string
  winner: "local" | "remote"
  localVersion: Expense
  remoteVersion: Expense
  reason: "newer_timestamp"
}

/**
 * Represents a true conflict that requires user intervention
 */
export interface TrueConflict {
  expenseId: string
  localVersion: Expense
  remoteVersion: Expense
  reason: "equal_timestamps" | "within_threshold"
}

/**
 * The complete result of merging local and remote expenses
 */
export interface MergeResult {
  /** The final merged set of expenses */
  merged: Expense[]
  /** Expenses that were added from remote (new to local) */
  addedFromRemote: Expense[]
  /** Expenses that were updated from remote (remote was newer) */
  updatedFromRemote: Expense[]
  /** Expenses that were added from local (new to remote) */
  addedFromLocal: Expense[]
  /** Expenses that were updated from local (local was newer) */
  updatedFromLocal: Expense[]
  /** Conflicts that were automatically resolved using timestamps */
  autoResolved: AutoResolvedConflict[]
  /** True conflicts that require user intervention */
  trueConflicts: TrueConflict[]
}

/**
 * Options for the merge operation
 */
export interface MergeOptions {
  /** Threshold in milliseconds for considering timestamps as "equal" (default: 1000ms) */
  conflictThresholdMs?: number
}

/** Default conflict threshold in milliseconds */
export const DEFAULT_CONFLICT_THRESHOLD_MS = 1000

/**
 * Check if two expenses have identical content (excluding timestamps for comparison purposes)
 * Includes deletedAt in the comparison since soft delete state is part of content
 */
function expensesAreIdentical(a: Expense, b: Expense): boolean {
  // Cast to access optional deletedAt field (will be added in Task 2)
  const aDeleted = (a as Expense & { deletedAt?: string }).deletedAt
  const bDeleted = (b as Expense & { deletedAt?: string }).deletedAt

  return (
    a.amount === b.amount &&
    a.currency === b.currency &&
    a.category === b.category &&
    a.date === b.date &&
    a.note === b.note &&
    a.paymentMethod?.type === b.paymentMethod?.type &&
    a.paymentMethod?.identifier === b.paymentMethod?.identifier &&
    aDeleted === bDeleted
  )
}

/**
 * Merge local and remote expenses using ID-based merging with timestamp conflict resolution.
 *
 * The merge follows these rules:
 * 1. Expenses only in local → included in result
 * 2. Expenses only in remote → included in result
 * 3. Expenses in both with identical content → included once
 * 4. Expenses in both with different content → resolved by timestamp or flagged as conflict
 *
 * Soft delete handling:
 * - Soft-deleted expenses (with deletedAt set) are treated as valid records
 * - They participate in merge and conflict resolution like normal expenses
 * - The newer version wins, including soft-delete state changes
 *
 * @param local - Array of local expenses (including soft-deleted)
 * @param remote - Array of remote expenses (including soft-deleted)
 * @param options - Optional merge configuration
 * @returns MergeResult with merged expenses and conflict information
 */
export function mergeExpenses(
  local: Expense[],
  remote: Expense[],
  options: MergeOptions = {}
): MergeResult {
  const { conflictThresholdMs = DEFAULT_CONFLICT_THRESHOLD_MS } = options

  // Create maps for O(1) lookup by ID
  const localMap = new Map(local.map((e) => [e.id, e]))
  const remoteMap = new Map(remote.map((e) => [e.id, e]))

  // Initialize result arrays
  const merged: Expense[] = []
  const addedFromRemote: Expense[] = []
  const updatedFromRemote: Expense[] = []
  const addedFromLocal: Expense[] = []
  const updatedFromLocal: Expense[] = []
  const autoResolved: AutoResolvedConflict[] = []
  const trueConflicts: TrueConflict[] = []

  // Get all unique IDs from both sets
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

  for (const id of allIds) {
    const localItem = localMap.get(id)
    const remoteItem = remoteMap.get(id)

    if (localItem && remoteItem) {
      // Case: Expense exists in both local and remote
      handleBothExist(
        localItem,
        remoteItem,
        conflictThresholdMs,
        merged,
        updatedFromRemote,
        updatedFromLocal,
        autoResolved,
        trueConflicts
      )
    } else if (localItem) {
      // Case: Expense only exists locally
      handleLocalOnly(localItem, merged, addedFromLocal)
    } else if (remoteItem) {
      // Case: Expense only exists remotely
      handleRemoteOnly(remoteItem, merged, addedFromRemote)
    }
  }

  // Sort merged expenses by creation date (newest first)
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return {
    merged,
    addedFromRemote,
    updatedFromRemote,
    addedFromLocal,
    updatedFromLocal,
    autoResolved,
    trueConflicts,
  }
}

/**
 * Handle case where expense exists in both local and remote
 */
function handleBothExist(
  localItem: Expense,
  remoteItem: Expense,
  conflictThresholdMs: number,
  merged: Expense[],
  updatedFromRemote: Expense[],
  updatedFromLocal: Expense[],
  autoResolved: AutoResolvedConflict[],
  trueConflicts: TrueConflict[]
): void {
  // If content is identical (including soft-delete state), just include one copy
  if (expensesAreIdentical(localItem, remoteItem)) {
    // Keep the one with newer timestamp (or local if equal)
    const localTime = new Date(localItem.updatedAt).getTime()
    const remoteTime = new Date(remoteItem.updatedAt).getTime()
    merged.push(remoteTime > localTime ? remoteItem : localItem)
    return
  }

  // Content differs - need to resolve conflict
  resolveConflict(
    localItem,
    remoteItem,
    conflictThresholdMs,
    merged,
    updatedFromRemote,
    updatedFromLocal,
    autoResolved,
    trueConflicts
  )
}

/**
 * Handle case where expense only exists locally
 */
function handleLocalOnly(
  localItem: Expense,
  merged: Expense[],
  addedFromLocal: Expense[]
): void {
  // Local-only expense - include it in the merge result
  merged.push(localItem)
  addedFromLocal.push(localItem)
}

/**
 * Handle case where expense only exists remotely
 */
function handleRemoteOnly(
  remoteItem: Expense,
  merged: Expense[],
  addedFromRemote: Expense[]
): void {
  // Remote-only expense - include it in the merge result
  merged.push(remoteItem)
  addedFromRemote.push(remoteItem)
}

/**
 * Resolve conflict between local and remote versions of the same expense.
 *
 * Resolution rules:
 * 1. If timestamps differ by more than threshold → newer wins (auto-resolved)
 * 2. If timestamps are equal or within threshold → true conflict (needs user input)
 *
 * Note: Soft-deleted expenses participate in conflict resolution normally.
 * If one version is soft-deleted and the other isn't, the newer one wins.
 */
function resolveConflict(
  localItem: Expense,
  remoteItem: Expense,
  conflictThresholdMs: number,
  merged: Expense[],
  updatedFromRemote: Expense[],
  updatedFromLocal: Expense[],
  autoResolved: AutoResolvedConflict[],
  trueConflicts: TrueConflict[]
): void {
  const localTime = new Date(localItem.updatedAt).getTime()
  const remoteTime = new Date(remoteItem.updatedAt).getTime()
  const timeDiff = Math.abs(localTime - remoteTime)

  // Check if timestamps are within the conflict threshold
  if (timeDiff <= conflictThresholdMs) {
    // True conflict - timestamps are too close to auto-resolve
    trueConflicts.push({
      expenseId: localItem.id,
      localVersion: localItem,
      remoteVersion: remoteItem,
      reason: timeDiff === 0 ? "equal_timestamps" : "within_threshold",
    })
    // Don't add to merged yet - will be resolved by user
    return
  }

  // Auto-resolve based on timestamp
  if (remoteTime > localTime) {
    // Remote is newer - use remote version
    merged.push(remoteItem)
    updatedFromRemote.push(remoteItem)
    autoResolved.push({
      expenseId: localItem.id,
      winner: "remote",
      localVersion: localItem,
      remoteVersion: remoteItem,
      reason: "newer_timestamp",
    })
  } else {
    // Local is newer - use local version
    merged.push(localItem)
    updatedFromLocal.push(localItem)
    autoResolved.push({
      expenseId: localItem.id,
      winner: "local",
      localVersion: localItem,
      remoteVersion: remoteItem,
      reason: "newer_timestamp",
    })
  }
}

/**
 * Apply conflict resolutions to a merge result.
 * This is called after the user has resolved true conflicts.
 *
 * @param mergeResult - The original merge result with unresolved conflicts
 * @param resolutions - Map of expense ID to chosen version ("local" or "remote")
 * @returns Updated merge result with conflicts resolved
 */
export function applyConflictResolutions(
  mergeResult: MergeResult,
  resolutions: Map<string, "local" | "remote">
): MergeResult {
  const updatedMerged = [...mergeResult.merged]
  const updatedFromRemote = [...mergeResult.updatedFromRemote]
  const updatedFromLocal = [...mergeResult.updatedFromLocal]
  const remainingConflicts: TrueConflict[] = []

  for (const conflict of mergeResult.trueConflicts) {
    const choice = resolutions.get(conflict.expenseId)

    if (!choice) {
      // No resolution provided - keep as conflict
      remainingConflicts.push(conflict)
      continue
    }

    if (choice === "local") {
      updatedMerged.push(conflict.localVersion)
      updatedFromLocal.push(conflict.localVersion)
    } else {
      updatedMerged.push(conflict.remoteVersion)
      updatedFromRemote.push(conflict.remoteVersion)
    }
  }

  // Re-sort merged expenses by creation date (newest first)
  updatedMerged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return {
    ...mergeResult,
    merged: updatedMerged,
    updatedFromRemote,
    updatedFromLocal,
    trueConflicts: remainingConflicts,
  }
}
