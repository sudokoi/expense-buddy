---
"expense-buddy": minor
---

Extract shared expense derivations into `useDerivedExpenseData` hook

- Consolidates currency grouping, available months, and effective currency
  resolution into a single-pass derivation shared across all tabs
- Removes redundant expense iterations (Dashboard, History, Filters,
  Analytics each previously computed these independently)
- Replaces imperative `useEffect`-based month validation with a pure
  derived value (`effectiveSelectedMonth`)
- Adds `useDeferredValue` in History tab for responsive UI during
  expensive filter/sort/group computations
- Fixes filter persistence race condition where multiple consumers
  mounting simultaneously caused stale storage to overwrite in-memory state
- Changes default timeWindow from "7d" to "all" for consistent reset behavior
- Removes `selectedCurrency` and `selectedMonth` parameters from
  `useAnalyticsBase` (consumed internally from shared filter store)
