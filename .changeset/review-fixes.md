---
"expense-buddy": patch
---

Address review feedback on the performance pass:

- Remove the unused `useDerivedExpenseDataStandalone` hook. All consumers use
  the context-based `useDerivedExpenseData`, and the unit tests call the pure
  `computeDerivedExpenseData` directly, so the standalone hook was dead code
  (and a second copy of the provider's memo that could drift).
- Avoid a redundant `computeEffectiveCurrency` call in `computeDerivedExpenseData`
  when no currency is selected — `defaultCurrency` now reuses `effectiveCurrency`
  in that case instead of recomputing.
- Hoist the empty `instruments` array in the Day view to a stable module-level
  constant (matching the dashboard), so the memoized `ExpenseRow` rows aren't
  passed a fresh `[]` identity on each render.
