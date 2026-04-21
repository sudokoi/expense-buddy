# Architecture

Expense Buddy is an Expo Router application with a local-first architecture. The app treats the device as the primary execution environment, GitHub as an optional user-controlled sync backend, and SMS import as a review-first pipeline that never requires a server.

This document focuses on the current architecture shape, the reasons behind the main boundaries, and the parts of the system that are most important when extending the app.

## Design Principles

- Local-first by default. Core expense tracking works without a backend.
- Review before import. SMS parsing produces staged candidates, not immediate expenses.
- Explicit state boundaries. Stores are split by persistence and sync requirements, not by screen alone.
- Deterministic extraction with local ML suggestions. The app keeps transaction extraction rule-based and uses native ML only for category suggestion when confidence is high enough.
- User-owned sync. GitHub is a transport and persistence target, not an application server.

## Runtime Layers

| Layer              | Responsibility                                           | Main locations                                                          |
| ------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Routes             | Screen composition and navigation                        | `app/`                                                                  |
| Components         | Reusable presentational building blocks                  | `components/`                                                           |
| Hooks              | Screen-facing composition, derived state, and view logic | `hooks/`                                                                |
| Stores             | Long-lived application state                             | `stores/`                                                               |
| Services           | Persistence, sync, parsing, import, and data transforms  | `services/`                                                             |
| Native modules     | Android SMS access and Play Core integrations            | `modules/expense-buddy-sms-import/`, `modules/expense-buddy-play-core/` |
| Shared definitions | constants, types, utilities, locale resources            | `constants/`, `types/`, `utils/`, `locales/`                            |

The main dependency direction is:

1. Routes render components and call hooks.
2. Hooks read from stores and invoke service-layer actions.
3. Stores hold durable state and expose explicit update events.
4. Services handle I/O, parsing, merging, persistence, and sync.
5. Native modules are accessed through service-layer wrappers rather than directly from screens.

## State Model

Expense Buddy uses XState lightweight stores for most long-lived state, plus a dedicated XState machine for sync lifecycle control.

| Store                   | Purpose                                                 | Persists locally | Syncs across devices      |
| ----------------------- | ------------------------------------------------------- | ---------------- | ------------------------- |
| Expense Store           | Expense records and expense mutations                   | Yes              | Yes                       |
| Settings Store          | Categories, instruments, app preferences, sync settings | Yes              | Yes for syncable settings |
| Filter Store            | Shared History and Analytics filter state               | Yes              | No                        |
| SMS Import Review Store | Parsed SMS candidates and review actions                | Yes              | No                        |
| UI State Store          | Device-local expansion and layout preferences           | Yes              | No                        |
| Notification Store      | Toasts and transient feedback                           | No               | No                        |

Selection rules:

- If the data should survive app restarts and sync across devices, it belongs in Expense Store or Settings Store.
- If it should survive restarts but remain local to the device, it belongs in Filter Store, UI State Store, or SMS Import Review Store.
- If it is purely transient UI feedback, it belongs in Notification Store.

The sync state machine coordinates fetch, merge, push, conflict, and error states. It is intentionally separate from the data stores so sync orchestration does not leak into normal state updates.

## Persistence Model

| Data               | Local storage         | Remote storage                     | Notes                                        |
| ------------------ | --------------------- | ---------------------------------- | -------------------------------------------- |
| Expenses           | AsyncStorage snapshot | Daily CSV files in GitHub          | Soft deletes are preserved with `deletedAt`  |
| Settings           | AsyncStorage          | Optional `settings.json` in GitHub | Credentials are excluded                     |
| GitHub credentials | Secure storage        | No                                 | Token and repo configuration stay on-device  |
| Filters            | AsyncStorage          | No                                 | Shared between History and Analytics locally |
| SMS review queue   | AsyncStorage          | No                                 | Raw SMS import data stays local              |
| Dirty-day metadata | AsyncStorage          | No                                 | Used to minimize sync work                   |
| Remote SHA cache   | AsyncStorage          | No                                 | Used to skip unchanged downloads             |

This split supports offline-first behavior while keeping the sync format small and inspectable.

## SMS Import Architecture

SMS import is intentionally narrow in the current product scope.

Current constraints:

- Android only
- Recent-window scanning rather than full historical inbox import
- Deterministic extraction for explainable matches
- Native LiteRT category suggestions with regex fallback
- Review-first staging before an expense is created
- Local-only raw SMS handling

Runtime flow:

1. The app checks SMS permission status on startup without prompting.
2. If permission was already granted, bootstrap logic can scan the bounded recent window.
3. A manual scan from Settings requests `READ_SMS` inline when needed.
4. `services/sms-import/parser.ts` extracts amount, merchant hints, date context, payment method hints, and a regex fallback category suggestion.
5. `services/sms-import/bootstrap.ts` batches eligible messages through the Android native module for LiteRT category inference.
6. The native module mirrors the Python export contract with deterministic hashed token features and replaces the category suggestion only when the model clears its confidence gate.
7. `services/sms-import/fingerprint.ts` and related dedupe logic prevent repeated staging of the same transaction.
8. Parsed candidates are stored in the SMS Import Review Store.
9. The review UI lets the user accept, edit, reject, dismiss, or clear staged items.
10. Only accepted items are converted into normal expense records and enter the regular sync flow.

Why this hybrid shape:

- easier to debug against real SMS fixtures
- easier to explain to users in a review-first flow
- keeps deterministic extraction on the JS side while moving actual category inference off the JS thread
- lets the app ship a native model bundle without requiring server-side parsing or on-device training

Planned direction:

- keep all parsing on-device
- broaden parser coverage over time
- replace the seed LiteRT model with one trained on more independent labels
- add local personalization only after the base on-device model is stable enough to justify it

There is no server-side parsing roadmap. Any future ML-based parser is expected to remain local to the device.

Related decisions:

- [ADR-002: Regex-First SMS Import](./decisions/adr-002-regex-first-sms-import.md)
- [ADR-004: Android-Only Scope and Play Permission Gate](./decisions/adr-004-android-only-scope-and-play-permission-gate.md)
- [On-Device ML SMS Categorization Proposal](./decisions/proposal-on-device-ml-sms-categorization.md)

## GitHub Sync Architecture

The sync system follows a fetch-merge-push model so local and remote edits are reconciled before upload.

Sync phases:

1. Determine whether the current action is a fetch, push, combined sync, or conflict resolution step.
2. Fetch the remote repository tree through the Git Trees API.
3. Compare remote blob SHAs against the local SHA cache.
4. Download only changed daily files when needed.
5. Merge remote and local expenses by expense ID.
6. Resolve most conflicts automatically using timestamps, and surface true conflicts when edits are too close together.
7. Upload only dirty day files and confirmed deletions.
8. Update local caches and clear dirty-day metadata after success.

Key data model rules:

- expenses are stored remotely as `expenses-YYYY-MM-DD.csv`
- deletions are represented by `deletedAt` instead of hard removal
- settings sync is optional and separated from credentials
- conflict resolution favors correctness over minimizing prompts

Optimization strategy:

- Git Trees API reduces fetch overhead by retrieving the remote tree and blob SHAs in one call
- remote SHA caching skips downloads for unchanged files
- dirty-day tracking limits hashing and uploads to changed dates only
- batched writes keep uploads atomic at the commit level

The sync engine is designed so a user can stay productive offline and reconcile later without losing the edit history needed for conflict handling.

## Update and Review Architecture

App update and in-app review behavior is split by install source.

- Play-installed Android builds use the local `expense-buddy-play-core` Expo module.
- Non-Play Android builds keep the GitHub Releases fallback for update discovery and the release-page update action.
- In-app review is requested only on Play installs and only after local gating conditions are met.

Runtime flow:

1. `services/update-checker.ts` determines whether the current install should use Play Core or GitHub Releases.
2. `services/play-store-update.ts` wraps the Play Core Expo module for update availability, flexible update start, completion, and status events.
3. `hooks/use-update-check.ts` owns banner visibility and chooses between Play Core actions and GitHub release URLs.
4. `services/play-store-review.ts` wraps the same Play Core module for in-app review requests.
5. `hooks/use-play-store-review.ts` stores conservative local gating state so prompts are delayed, version-scoped, and rate-limited.
6. `app/_layout.tsx` marks the current version review-eligible only after the changelog flow finishes, which avoids stacking a review prompt immediately after an update notice.

Why this shape:

- keeps native Play integrations in tracked source instead of generated Android output
- preserves sideload and non-Play behavior without forking the app shell
- keeps review prompting conservative so Play quota and user experience constraints are both respected

## Analytics Architecture

Analytics is split into focused hooks so filtering, chart building, and statistics calculation do not force one another to recompute unnecessarily.

| Hook                     | Responsibility                                                    |
| ------------------------ | ----------------------------------------------------------------- |
| `useAnalyticsBase`       | Select effective currency, compute date ranges, and apply filters |
| `useAnalyticsCharts`     | Build chart-ready category, method, and trend datasets            |
| `useAnalyticsStatistics` | Build totals, averages, and summary statistics                    |
| `useAnalyticsData`       | Legacy composite wrapper; avoid for new work                      |

Important architectural decisions in analytics:

- Filter state is shared across History and Analytics through Filter Store.
- Filtering is implemented as a single-pass pipeline rather than repeated array filtering.
- Lookup structures such as Sets and Maps are built up front to keep checks close to O(1).
- Search runs late in the filter pipeline because it is the most expensive check.

The result is a predictable path from raw expenses to filtered datasets to charts and summary cards, without duplicating filter logic across screens.

## Internationalization and App Shell

- i18next is the translation source of truth.
- Locale bundles load dynamically so only the active language is needed at startup.
- Locale-aware formatting is derived from the active language and device preferences.
- The app shell is composed through Expo Router layouts and shared providers in `components/Provider.tsx`.

This keeps startup lean while ensuring notifications, labels, and formatting remain consistent across screens.

## Performance Considerations

- Store selectors are kept granular to avoid unrelated re-renders.
- Search input is debounced at the filter-store layer.
- Analytics filtering is single-pass to reduce intermediate allocations.
- History views rely on list virtualization for large datasets.
- Sync minimizes API calls through SHA caching and dirty-day tracking.
- Dynamic locale loading avoids bundling every language into the initial startup path.

## Testing Strategy

The architecture is supported by both unit tests and property-based tests.

Areas with strong automated coverage include:

- sync orchestration and merge behavior
- storage and migration logic
- SMS import parsing and suggestion resolution
- settings and expense store behavior
- update checks and error classification
- analytics and filter invariants

Property-based tests are used where the system benefits from invariant checking across many generated inputs, especially around merge logic, sync behavior, and data transformations.

## When to Extend vs Replace

Before adding new architecture layers, prefer extending the existing seams:

- add new durable data through an existing store or a narrowly scoped new store
- add new side effects in services, not in components
- keep screen hooks as orchestration layers, not persistence layers
- prefer explicit ADRs for changes that alter sync, import, or platform scope

If a future change introduces on-device ML parsing, background ingestion, or a new sync target, that change should be documented in a new ADR before it is treated as the default architecture.
