---
"expense-buddy": patch
---

Share derived expense data (`useDerivedExpenseData`) via a single `DerivedExpenseDataProvider` instead of recomputing the currency grouping and month derivation once per screen. Previously each screen (Dashboard, History, Filters, Analytics) re-ran the full derivation on mount even though the inputs are identical. The provider now computes it once per store change and all consumers read from context. A `useDerivedExpenseDataStandalone` hook is available for isolated tests that don't mount the provider.
