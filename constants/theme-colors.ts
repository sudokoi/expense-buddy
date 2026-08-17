/**
 * Backward-compatible re-export of the canonical theme tokens.
 *
 * The single source of truth now lives in `constants/palette.ts` (ADR-008).
 * Existing imports keep working; prefer importing from `./palette` in new code.
 */
export * from "./palette"
