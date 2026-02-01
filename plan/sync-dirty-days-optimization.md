# Sync Dirty-Day Optimization Plan

## Goals

- Track day-level changes for CSV-per-day sync to avoid scanning all days on sync.
- Persist dirty day tracking across app restarts.
- Clear dirty tracking after syncDown/replace.
- Enhance global sync notification to show counts of local/remote files updated.

## Scope

- Services: change tracking + sync manager.
- Stores: expense mutations (add/edit/delete/bulk updates/replace).
- Notifications: global sync messaging only (no file list).
- Tests: unit + integration/property updates for new behavior.

## Data Model

- Persisted storage key: `expense_dirty_days` (AsyncStorage).
- Stored shape:
  - `dirtyDays: string[]` (day keys that must be re-synced).
  - `deletedDays: string[]` (day keys that might require remote delete).

## API Design

- New module: `services/expense-dirty-days.ts` with:
  - `loadDirtyDays()`
  - `saveDirtyDays(state)`
  - `markDirtyDay(dayKey)`
  - `markDeletedDay(dayKey)`
  - `clearDirtyDays()`
  - `consumeDirtyDays()` (returns sets + clears after successful syncUp)

## Integration Points

### Expense Store

- `addExpense` -> mark dirty day.
- `editExpense` -> mark old day dirty; if date changed, mark new day dirty.
- `deleteExpense` -> mark dirty + deleted day.
- `replaceExpenses` -> clear dirty/deleted sets.
- Bulk update actions (category reassign/rename) -> mark dirty for each affected day.

### Sync Up (sync-manager)

- Load dirty/deleted sets before building upload/delete lists.
- Only compute CSV + hash for dirty days.
- Delete candidates only from `deletedDays` (still obey local-range guard).
- If no dirty/deleted changes and settings unchanged, short-circuit with no changes.
- On success: update hashes for dirty days; remove hashes for deleted days; clear dirty state.

### Git-Style Sync (gitStyleSync push phase)

- Apply same dirty-day filtering for uploads/deletes.
- Keep merge + conflict logic unchanged.

### Sync Result Counts

- Add `localFilesUpdated` and `remoteFilesUpdated` to sync result types.
- Populate for:
  - `syncUp` and git-style push: uploads + deletions.
  - `syncDown`/`syncDownMore`: downloaded files count.

### Global Sync Notification

- Update success notifications to include counts only:
  - "Sync complete — X local files updated, Y remote files updated"
- Use zero when counts are missing.
- Keep localization keys unless new ones are preferred.

## Testing

- New unit tests for `expense-dirty-days` persistence + mark/clear.
- Expense store tests for:
  - edit with date change marks both days.
  - replaceExpenses clears dirty state.
- Sync tests to assert:
  - only dirty days are processed.
  - localFilesUpdated/remoteFilesUpdated counts are populated.

## Rollout

- No migration required; missing key defaults to empty sets.
- Existing sync behavior remains as fallback when no dirty info is present.
