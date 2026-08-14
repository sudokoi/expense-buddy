---
"expense-buddy": patch
---

Refactor internals to deepen modules and narrow interfaces with no user-facing
behavior change:

- Extract the shared applied-filter summary and payment-instrument selection
  rules into a single `filter-summary` module, removing copy-pasted formatting
  from the Analytics, History, and Filters screens
- Split GitHub API error mapping into its own `github-api-error` module and
  narrow the GitHub port by un-exporting internal Git Data plumbing and removing
  the dead `uploadCSV`, `deleteFile`, and `uploadSettingsFile` operations
- Extract post-sync queued-op reconciliation into a pure `sync-reconcile` module
  and reuse it in both the interactive and auto-sync paths
- Remove the dead legacy sync pipeline (`syncUp`, `migrateToDailyFiles`,
  `determineSyncDirection`, `getPendingSyncCount`) superseded by git-style sync
- Reuse the `secure-storage` abstraction in the settings manager, derive payment
  instrument last-digits length from the shared payment-method config, and
  collapse the duplicated auto-sync orchestration helpers
- Drop unused exports across services, stores, and hooks
