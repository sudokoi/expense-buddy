---
"expense-buddy": minor
---

### Features

- Add "Rent" expense category with Building icon and soft olive green color
- Unify sync buttons into single intelligent "Sync" button with automatic push/pull detection
- Reorder categories by usage frequency (Food → Transport → Groceries → Rent → ...)

### Refactoring

- Migrate sync state management from xstate to TanStack Query mutations
- Add `useSyncPush`, `useSyncPull`, `useSmartSync`, and `useSyncStatus` hooks
- Remove `sync-status-store.ts` in favor of mutation-derived state
