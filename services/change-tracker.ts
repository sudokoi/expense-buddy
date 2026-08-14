import { getItem, setItem } from "./storage"

const PENDING_CHANGES_KEY = "pending_sync_changes"

interface PendingChanges {
  added: Set<string> // expense IDs that were added
  edited: Set<string> // expense IDs that were edited
  deleted: Set<string> // expense IDs that were deleted
}

interface StoredPendingChanges {
  added: string[]
  edited: string[]
  deleted: string[]
}

/**
 * Load pending changes from storage
 */
async function loadPendingChanges(): Promise<PendingChanges> {
  try {
    const stored = await getItem(PENDING_CHANGES_KEY)
    if (stored) {
      const parsed: StoredPendingChanges = JSON.parse(stored)
      return {
        added: new Set(parsed.added || []),
        edited: new Set(parsed.edited || []),
        deleted: new Set(parsed.deleted || []),
      }
    }
  } catch (error) {
    console.warn("Failed to load pending changes:", error)
  }
  return { added: new Set(), edited: new Set(), deleted: new Set() }
}

/**
 * Save pending changes to storage
 */
async function savePendingChanges(changes: PendingChanges): Promise<void> {
  try {
    const toStore: StoredPendingChanges = {
      added: Array.from(changes.added),
      edited: Array.from(changes.edited),
      deleted: Array.from(changes.deleted),
    }
    await setItem(PENDING_CHANGES_KEY, JSON.stringify(toStore))
  } catch (error) {
    console.warn("Failed to save pending changes:", error)
  }
}

/**
 * Track multiple expenses as edited in a single storage read/write.
 * Useful for migrations or bulk relinking.
 */
export async function trackBulkEdit(expenseIds: string[]): Promise<void> {
  if (expenseIds.length === 0) return

  const changes = await loadPendingChanges()
  for (const expenseId of expenseIds) {
    if (!changes.added.has(expenseId)) {
      changes.edited.add(expenseId)
    }
  }
  await savePendingChanges(changes)
}
