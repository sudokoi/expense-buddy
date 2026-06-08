import { computeContentHash } from "../hash-storage"

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
