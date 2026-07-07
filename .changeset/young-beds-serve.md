---
"expense-buddy": minor
---

Optimize filter UI performance and fix stale-state bugs

- Shared `useDerivedExpenseData` hook: single-pass currency grouping, month extraction, and currency resolution across all tabs
- `useDeferredValue` in History tab keeps UI responsive during heavy filter re-renders
- Remove collapsible sections from Filters screen (flat layout, faster mount)
- Fix empty list after filter reset (default timeWindow changed to "all")
- Fix stale month chip when switching currencies (derived `effectiveSelectedMonth`)
- Remove dead `getAvailableMonths` utility (scoped derivation in hook)
