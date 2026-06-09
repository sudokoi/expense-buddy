import { computeContentHash } from "../hash-storage"
import { getDayKeyFromFilename } from "../daily-file-manager"

/**
 * Content hash for file dedup / change detection.
 *
 * Delegates to the canonical {@link computeContentHash} (djb2) so there is a
 * single hashing implementation across the sync layer. Kept as a named export
 * because provider snapshot code references `simpleHash`; the output is
 * identical to the previous inline implementation, so existing stored manifest
 * hashes remain valid.
 */
export function simpleHash(content: string): string {
  return computeContentHash(content)
}

/**
 * Out-of-range deletion guard (Requirement 6.3): never delete a remote day file
 * that falls outside the covered date range of the local/merged data. When an
 * explicit range is supplied it is used directly; otherwise it is inferred from
 * the snapshot's own content files as a fallback. Non-day-file entries (e.g.
 * settings.json) always pass through.
 */
export function applyDeletionRangeGuard(
  files: Record<string, string>,
  coveredDayRange?: { oldest: string; newest: string } | null
): Record<string, string> {
  let oldest: string | null = coveredDayRange?.oldest ?? null
  let newest: string | null = coveredDayRange?.newest ?? null

  if (oldest === null || newest === null) {
    for (const [path, content] of Object.entries(files)) {
      if (content.length === 0) continue
      const dayKey = getDayKeyFromFilename(path)
      if (dayKey === null) continue
      if (oldest === null || dayKey < oldest) oldest = dayKey
      if (newest === null || dayKey > newest) newest = dayKey
    }
  }

  const guarded: Record<string, string> = {}

  for (const [path, content] of Object.entries(files)) {
    if (content.length > 0) {
      guarded[path] = content
      continue
    }

    const dayKey = getDayKeyFromFilename(path)
    if (dayKey === null) {
      guarded[path] = content
      continue
    }

    const withinRange =
      oldest !== null && newest !== null && dayKey >= oldest && dayKey <= newest
    if (withinRange) {
      guarded[path] = content
    }
  }

  return guarded
}
