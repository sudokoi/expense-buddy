---
"expense-buddy": patch
---

Polish Android UI, performance, and build reliability

- Unify warm light/dark styling, compact controls, and themed confirmations; streamline inline payment entry, persistent form actions, and History controls.
- Refine spending trends, compact chart legends, and currency-aware filters, with direct trend aggregation and shared lookups.
- Complete UI and native widget/SMS localization, backed by stronger theme and translation checks.
- Make SMS batches atomic, add cancellable scans with resumable progress, virtualize review lists, and bound background logging.
- Coalesce widget refreshes, retain fresh trailing updates, and calculate only the data each widget displays.
- Align Expo SDK 57 and React Native patches, including the constants resolution, for clean Expo Doctor checks.
- Apply reproducible CI/EAS build budgets and safe diagnostics, with manual builds defaulting to build-only.
- Remove obsolete chart/payment-filter code, strengthen active-path tests with deterministic fixtures, and eliminate redundant logger-test polling.
