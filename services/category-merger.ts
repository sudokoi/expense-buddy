/**
 * CategoryMerger - Merge logic for syncing categories between local and remote
 *
 * Implements a merge strategy where:
 * 1. Categories only in local → included in result
 * 2. Categories only in remote → included in result
 * 3. Categories in both with same label → resolved by updatedAt timestamp (newer wins)
 * 4. "Other" category is always ensured to exist in the result
 */

import { Category } from "../types/category"
import { DEFAULT_CATEGORIES } from "../constants/default-categories"

/**
 * Result of merging local and remote categories
 */
export interface CategoryMergeResult {
  /** The final merged set of categories */
  merged: Category[]
  /** Category labels that were added from remote (new to local) */
  addedFromRemote: string[]
  /** Category labels that were added from local (new to remote) */
  addedFromLocal: string[]
  /** Category labels that were updated from remote (remote was newer) */
  updatedFromRemote: string[]
  /** Category labels that were updated from local (local was newer) */
  updatedFromLocal: string[]
  /** Category labels where both had changes (resolved by updatedAt) */
  conflicts: string[]
}

/**
 * Get the default "Other" category
 */
function getDefaultOtherCategory(): Category {
  const other = DEFAULT_CATEGORIES.find((c) => c.label === "Other")
  if (other) {
    return { ...other }
  }
  // Fallback if somehow not found in defaults
  return {
    label: "Other",
    icon: "Circle",
    color: "#C4B7C9",
    order: 999,
    isDefault: true,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Check if two categories have identical content (excluding updatedAt for comparison)
 */
function categoriesAreIdentical(a: Category, b: Category): boolean {
  return (
    a.label === b.label &&
    a.icon === b.icon &&
    a.color === b.color &&
    a.order === b.order &&
    a.isDefault === b.isDefault
  )
}

/**
 * Merge local and remote categories using label-based merging with timestamp conflict resolution.
 *
 * The merge follows these rules:
 * 1. Categories only in local → included in result, marked as addedFromLocal
 * 2. Categories only in remote → included in result, marked as addedFromRemote
 * 3. Categories in both with identical content → included once (prefer newer timestamp)
 * 4. Categories in both with different content → resolved by updatedAt (newer wins)
 * 5. "Other" category is always ensured to exist in the final result
 *
 * @param local - Array of local categories
 * @param remote - Array of remote categories
 * @returns CategoryMergeResult with merged categories and change information
 */
export function mergeCategories(
  local: Category[],
  remote: Category[]
): CategoryMergeResult {
  // Create maps for O(1) lookup by label (case-insensitive)
  const localMap = new Map(local.map((c) => [c.label.toLowerCase(), c]))
  const remoteMap = new Map(remote.map((c) => [c.label.toLowerCase(), c]))

  // Initialize result arrays
  const merged: Category[] = []
  const addedFromRemote: string[] = []
  const addedFromLocal: string[] = []
  const updatedFromRemote: string[] = []
  const updatedFromLocal: string[] = []
  const conflicts: string[] = []

  // Get all unique labels from both sets (case-insensitive)
  const allLabels = new Set([...localMap.keys(), ...remoteMap.keys()])

  for (const labelKey of allLabels) {
    const localItem = localMap.get(labelKey)
    const remoteItem = remoteMap.get(labelKey)

    if (localItem && remoteItem) {
      // Category exists in both local and remote
      handleBothExist(
        localItem,
        remoteItem,
        merged,
        updatedFromRemote,
        updatedFromLocal,
        conflicts
      )
    } else if (localItem) {
      // Category only exists locally
      merged.push(localItem)
      addedFromLocal.push(localItem.label)
    } else if (remoteItem) {
      // Category only exists remotely
      merged.push(remoteItem)
      addedFromRemote.push(remoteItem.label)
    }
  }

  // Ensure "Other" category always exists
  const hasOther = merged.some((c) => c.label.toLowerCase() === "other")
  if (!hasOther) {
    const otherCategory = getDefaultOtherCategory()
    // Set order to be last
    otherCategory.order = Math.max(...merged.map((c) => c.order), -1) + 1
    merged.push(otherCategory)
  }

  // Sort merged categories by order
  merged.sort((a, b) => a.order - b.order)

  // Reassign order values to be sequential (0, 1, 2, ...)
  merged.forEach((category, index) => {
    category.order = index
  })

  return {
    merged,
    addedFromRemote,
    addedFromLocal,
    updatedFromRemote,
    updatedFromLocal,
    conflicts,
  }
}

/**
 * Handle case where category exists in both local and remote
 */
function handleBothExist(
  localItem: Category,
  remoteItem: Category,
  merged: Category[],
  updatedFromRemote: string[],
  updatedFromLocal: string[],
  conflicts: string[]
): void {
  // If content is identical, just include one copy (prefer newer timestamp)
  if (categoriesAreIdentical(localItem, remoteItem)) {
    const localTime = new Date(localItem.updatedAt).getTime()
    const remoteTime = new Date(remoteItem.updatedAt).getTime()
    merged.push(remoteTime > localTime ? remoteItem : localItem)
    return
  }

  // Content differs - resolve by timestamp
  const localTime = new Date(localItem.updatedAt).getTime()
  const remoteTime = new Date(remoteItem.updatedAt).getTime()

  // Track as conflict since both had changes
  conflicts.push(localItem.label)

  if (remoteTime > localTime) {
    // Remote is newer - use remote version
    merged.push(remoteItem)
    updatedFromRemote.push(remoteItem.label)
  } else {
    // Local is newer or equal - use local version
    merged.push(localItem)
    updatedFromLocal.push(localItem.label)
  }
}
