import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_CHANGES_KEY = "pending_sync_changes";

export interface PendingChanges {
  added: Set<string>; // expense IDs that were added
  edited: Set<string>; // expense IDs that were edited
  deleted: Set<string>; // expense IDs that were deleted
}

interface StoredPendingChanges {
  added: string[];
  edited: string[];
  deleted: string[];
}

/**
 * Load pending changes from storage
 */
export async function loadPendingChanges(): Promise<PendingChanges> {
  try {
    const stored = await AsyncStorage.getItem(PENDING_CHANGES_KEY);
    if (stored) {
      const parsed: StoredPendingChanges = JSON.parse(stored);
      return {
        added: new Set(parsed.added || []),
        edited: new Set(parsed.edited || []),
        deleted: new Set(parsed.deleted || []),
      };
    }
  } catch (error) {
    console.warn("Failed to load pending changes:", error);
  }
  return { added: new Set(), edited: new Set(), deleted: new Set() };
}

/**
 * Save pending changes to storage
 */
export async function savePendingChanges(
  changes: PendingChanges
): Promise<void> {
  try {
    const toStore: StoredPendingChanges = {
      added: Array.from(changes.added),
      edited: Array.from(changes.edited),
      deleted: Array.from(changes.deleted),
    };
    await AsyncStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.warn("Failed to save pending changes:", error);
  }
}

/**
 * Track a new expense being added
 */
export async function trackAdd(expenseId: string): Promise<void> {
  const changes = await loadPendingChanges();
  changes.added.add(expenseId);
  // If it was previously deleted, remove from deleted
  changes.deleted.delete(expenseId);
  await savePendingChanges(changes);
}

/**
 * Track an expense being edited
 */
export async function trackEdit(expenseId: string): Promise<void> {
  const changes = await loadPendingChanges();
  // Only track as edited if it wasn't just added (new items don't need edit tracking)
  if (!changes.added.has(expenseId)) {
    changes.edited.add(expenseId);
  }
  await savePendingChanges(changes);
}

/**
 * Track an expense being deleted
 */
export async function trackDelete(expenseId: string): Promise<void> {
  const changes = await loadPendingChanges();

  // If it was added but not synced yet, just remove from added (no need to track delete)
  if (changes.added.has(expenseId)) {
    changes.added.delete(expenseId);
  } else {
    // It was a synced item, track the deletion
    changes.deleted.add(expenseId);
  }

  // Remove from edited if it was there
  changes.edited.delete(expenseId);

  await savePendingChanges(changes);
}

/**
 * Clear all pending changes (call after successful sync)
 */
export async function clearPendingChanges(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_CHANGES_KEY);
  } catch (error) {
    console.warn("Failed to clear pending changes:", error);
  }
}

/**
 * Get the count of pending changes
 */
export async function getPendingChangesCount(): Promise<{
  added: number;
  edited: number;
  deleted: number;
  total: number;
}> {
  const changes = await loadPendingChanges();
  const added = changes.added.size;
  const edited = changes.edited.size;
  const deleted = changes.deleted.size;
  return {
    added,
    edited,
    deleted,
    total: added + edited + deleted,
  };
}
