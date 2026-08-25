# ADR-011: Local CSV Export — Direct Download (amended)

**Date:** 2026-08-23 (amended 2026-08-26)
**Status:** Accepted (amended)
**Related:** ADR-010 (Region Packs), `services/csv-handler.ts`, `services/csv-export.ts`, `hooks/use-export-action.ts`

---

## Context

Expense Buddy has no user-facing data export. Expenses reach GitHub only through optional sync (as per-day CSVs in `expenses-YYYY-MM-DD.csv` layout), which doubles as a backup — but users without sync configured, or wanting a portable copy outside their repo, have no path.

We want local CSV export now, designed so direct CSV import (from a picked local file) can be added later without rework.

Constraints discovered during analysis:

- `services/csv-handler.ts` already owns the canonical row schema (`id, amount, currency, category, date, note, paymentMethod*, createdAt, updatedAt, deletedAt`) with property-tested `exportToCSV`/`importFromCSV` round-trips, including soft-delete handling and legacy-currency fallback.
- The app ships no file/share/zip/document-picker packages today. Anything added becomes part of the native build surface.
- Typical expense volumes are small: ~100 bytes per row; even 100k expenses ≈ 10 MB raw. Compression saves little at realistic scales.

## Decision

### 1. Single flat CSV, reusing `exportToCSV` verbatim

Export produces one file containing **all expenses including soft-deleted rows**, using the exact `csv-handler` schema. Rationale:

- Guarantees a lossless round-trip when import lands later: `importFromCSV` already parses this schema, preserves `deletedAt`, and stamps missing currency via the fixed `INR` fallback.
- Soft-deleted rows must be included so an import into a fresh install can restore tombstones instead of resurrecting deleted expenses as active ones.
- Human-readable and directly openable in Excel/Sheets/Numbers — a stated purpose of local export is user-owned portability, not just machine backup.

### 2. No zip archive

Zip was evaluated and rejected for v1:

- A single CSV at realistic sizes gains almost nothing from compression while losing previewability everywhere (email clients, Drive previews, quick-look).
- Zipping only pays off if we exported the _daily-file tree_ mirroring the GitHub sync layout — but that mirror already exists in the user's repo whenever sync is enabled; duplicating it locally adds a second format to keep compatible.
- Every zip option costs real dependencies: `expo-zip` is another native module in an Android-only build; `jszip` needs Buffer polyfills under React Native. Neither buys user value today.

If a full-repo offline backup is ever wanted, it should be a separate "backup bundle" feature, not a bolt-on to CSV export.

### 3. Delivery: direct download (amended) + share fallback

**Original (2026-08-23):** cache directory + system share sheet.

**Amended (2026-08-26):** direct download as primary, share as fallback.

- Direct save via the modern `expo-file-system` `Directory`/`File` API: `Directory.pickDirectoryAsync()` (system folder picker, user picks Downloads) → `Directory.createFile(filename, "text/csv")` → `File.write(csv)`. Scoped grant — no `WRITE_EXTERNAL_STORAGE` / MediaStore permission.
- Fallback for non-interactive environments (tests, etc.): saves to app-private storage (`Paths.cache`/`Paths.document` fallback).
- **Fallback:** if SAF is unavailable or user cancels, `downloadExpensesToCsv` falls back to the original `cache + expo-sharing` flow; cancelled picker surfaces `exportCancelled` info toast without error.
- Filename convention unchanged: `expense-buddy-export-YYYY-MM-DD.csv`.

Rationale for amendment: users expected a single “Save to file” tap, not a chooser with mail/drive apps; SAF still keeps destination explicit (folder picker) for plaintext financial data.

- Avoids scoped-storage permissions entirely — no `WRITE_EXTERNAL_STORAGE`, no MediaStore dance.
- Destination selection remains explicit (system folder picker, or app-visible document folder).

### 4. Entry point: Settings

A single "Export CSV" action in Settings near sync/data controls, with a generating-state indicator and success/failure notification consistent with existing patterns. Not placed in History — export is a data-lifecycle action, not a browsing action; filtered/partial exports can revisit this later if demand appears.

### 5. Future import (shaping only, not built here)

The design intentionally leaves room for import:

- File acquisition via `expo-document-picker`
- Content parsing via the existing `importFromCSV`
- Reconciliation through the existing merge engine (`id` + `updatedAt` + `deletedAt` semantics, same as sync reconcile) rather than blind append
- A confirmation step showing counts (new / updated / conflicts) before anything is written

Because export already emits the full schema including tombstones, no export-side change will be needed when import arrives.

## Consequences

### Positive

- Zero changes to the CSV schema or sync format; pure addition.
- Lossless round-trip guaranteed by reusing tested codec functions on both ends.
- Minimal dependency footprint: two well-supported Expo modules (`file-system`, `sharing`), both pure-JS bridged, no config plugins.
- No new permissions on Android.

### Negative

- Plaintext financial data leaves the app sandbox once shared; mitigated by explicit destination choice, but nothing prevents careless destinations (e.g., public links).
- Very large histories produce large single files; acceptable until real users report it.
- Export includes soft-deleted rows, which may surprise users reading the file in a spreadsheet; a header note is impractical in CSV — accepted, documented here.

## Rejected alternatives (updated)

1. **Zipped daily-tree export mirroring the sync layout.**
   - Rejected: duplicates what GitHub sync already provides, adds native/JS zip dependencies, worse UX (not previewable). Revisit only as a distinct backup feature.
2. **Direct Downloads/MediaStore write without share sheet (original).**
   - **Originally rejected** (2026-08-23): requires storage permissions or MediaStore APIs for zero benefit over share sheet.
   - **Reconsidered and accepted** (2026-08-26) via `Directory.pickDirectoryAsync` + `createFile` — scoped permission via system picker, no `WRITE_EXTERNAL_STORAGE`, single-tap “Save to file” matches user expectation; share remains as fallback.
3. **Filtered/scoped exports (date range, category).**
   - Deferred: complicates the round-trip contract (partial imports need careful merge semantics). Ship whole-ledger export first.
4. **JSON export.**
   - Rejected: CSV is already the interchange format across sync/import paths; two formats double the maintenance for no current consumer.
