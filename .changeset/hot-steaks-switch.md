---
"expense-buddy": minor
---

**Refactored GitHub Sync Architecture with XState**

- **Architecture**: Replaced TanStack Query with a robust XState v5 state machine `sync-machine.ts` for better sync orchestration and error handling.
- **Performance**: Eliminated unnecessary remote data downloads when already in sync.
- **Bug Fixes**:
  - Fixed false "conflict" detection when creating new expenses.
  - Resolved issue where identical remote files were reported as updates.
- **UX**: Added user-friendly error messages for specific network and authentication failures (e.g., "No internet connection", "Rate limit exceeded").
- **Cleanup**: Removed `@tanstack/react-query` dependency and ~200 lines of dead code (`autoSync`, `analyzeConflicts`).
