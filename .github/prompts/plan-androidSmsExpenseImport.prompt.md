## Plan: Android SMS Expense Import

Build an Android-only, regex-first, review-first SMS import flow. The current version is intentionally narrow: scan at most the last 7 days of SMS during the initial bootstrap, parse locally, stage candidates in a local review queue, and only create expenses after user confirmation. Raw SMS stays on-device. No ML, no auto-add, no backend, no synced learnings, no continuous background service, and no hard iOS/web deletion in this version.

PR 43 is useful precedent for Android-only scope, review-first UX, and local-only SMS privacy. It is not the implementation baseline: that PR ended up ML/TFLite-only, removed regex parsing, handled new SMS only, and explicitly excluded historical inbox scans. This plan keeps the privacy and UX boundaries while switching back to regex and allowing a bounded 7-day bootstrap scan.

**Current version scope**

1. Android-only SMS import using Kotlin and Expo Modules API.
2. Initial historical scan limited to the last 7 days only.
3. Incremental app-open rescans using a saved cursor after the initial 7-day bootstrap.
4. India-first regex extraction, with an extensible locale registry for the app's supported locales.
5. Review-first queue shown on app open when pending items exist.
6. Batch accept, edit, and reject flow with a single follow-up sync path.
7. ADRs, architecture/docs/privacy updates, and soft Android-only de-scope.

**Out of scope for this version**

1. Scan windows beyond 7 days.
2. ML or TFLite parsing.
3. Auto-add or confidence-based bypass.
4. On-device retraining or synced learnings.
5. Always-on background or foreground services.
6. New-SMS broadcast receiver unless it is explicitly promoted into the next milestone after policy validation.
7. Hard removal of all iOS/web code and dependencies.

**Implementation milestones**

1. Milestone 0: ADRs and release gate.
   - Create the ADRs below before coding.
   - Validate Google Play restricted-permission requirements and reviewer materials.
   - Document that v1 is a 7-day bootstrap scan plus app-open review, not a full inbox import.
2. Milestone 1: Native Android SMS bridge.
   - Add a Kotlin Expo module with permission status, permission request, and bounded SMS query APIs.
   - Keep native responsibilities limited to reading SMS and returning normalized raw message records.
   - Do not add a background service in this version.
3. Milestone 2: Regex parser and dedupe.
   - Add India-first regex packs for bank debit, card spend, ATM withdrawal, and UPI transactions.
   - Keep parser strategy regex-only in v1; do not mix ML and regex.
   - Add deterministic fingerprints so 7-day rescans do not recreate review items.
   - Keep raw SMS body and sender out of synced expense records.
4. Milestone 3: Review queue and startup flow.
   - Add a local-only import-review store.
   - Startup order: initialize settings and expenses, run existing launch sync if enabled, run SMS scan, dedupe, persist pending items, show review UI.
   - The initial bootstrap scans only the last 7 days; subsequent app-open scans use the saved cursor.
   - Add a manual "scan again" entry point plus a way to reopen dismissed review items.
5. Milestone 4: Acceptance path and sync.
   - Add a batch-import event in the expense store so accepting multiple items marks dirty days in bulk and triggers at most one auto-sync follow-up.
   - Reuse existing validation and payment/category flows.
   - Prefer a separate local import-metadata store over changing the synced Expense schema in v1.
6. Milestone 5: Docs and Android-only positioning.
   - Update d:\code\expense-buddy\ARCHITECTURE.md, d:\code\expense-buddy\README.md, and d:\code\expense-buddy\PRIVACY.md.
   - Remove iOS/web product claims now, but defer hard code and dependency removal.
7. Next version candidates.
   - Extend the historical scan beyond 7 days.
   - Add new-SMS event capture behind a feature flag and policy review.
   - Revisit optional learnings sync only if the regex-first foundation proves insufficient.

**ADR files to create first**

1. d:\code\expense-buddy\decisions\adr-002-regex-first-sms-import.md
   - Focus: why v1 uses regex instead of reviving the PR 43 ML/TFLite path.
2. d:\code\expense-buddy\decisions\adr-003-review-first-local-only-sms-staging.md
   - Focus: why SMS-derived raw data, fingerprints, and review state stay local and are not synced to GitHub.
3. d:\code\expense-buddy\decisions\adr-004-android-only-scope-and-play-permission-gate.md
   - Focus: Android-only support, the 7-day bootstrap window, and the Google Play restricted-permission release gate.

**Suggested ADR structure**

1. Context
2. Decision
3. Consequences
4. Rejected alternatives
5. Privacy and policy notes
6. Rollout and follow-up scope

**Relevant files**

- d:\code\expense-buddy\stores\expense-store.ts — startup load path and the right place to add batch import persistence.
- d:\code\expense-buddy\stores\helpers.ts — current launch sync orchestration that the SMS bootstrap must sequence around.
- d:\code\expense-buddy\stores\store-provider.tsx — app startup seam for a dedicated startup coordinator.
- d:\code\expense-buddy\app_layout.tsx — launch overlay integration point for the review queue.
- d:\code\expense-buddy\components\ui\ChangelogSheet.tsx — reusable launch sheet pattern.
- d:\code\expense-buddy\types\expense.ts — synced expense schema reference.
- d:\code\expense-buddy\services\auto-sync-service.ts — must not be triggered once per accepted review item.
- d:\code\expense-buddy\app.config.js — Android permission/plugin wiring and later platform positioning cleanup.
- d:\code\expense-buddy\package.json — script cleanup for Android-only support.
- d:\code\expense-buddy\README.md — user-facing feature and platform support updates.
- d:\code\expense-buddy\PRIVACY.md — SMS permission and local-retention updates.
- d:\code\expense-buddy\decisions\adr-001-xstate-sync-machine.md — ADR format precedent.

**Verification**

1. Add parser tests for India-first fixtures and smoke fixtures for the other supported locales.
2. Verify the initial bootstrap scans only the last 7 days.
3. Verify subsequent app-open rescans use the saved cursor instead of reopening the full 7-day window unnecessarily.
4. Verify the review queue persists, can be reopened, and does not recreate items after dedupe.
5. Verify bulk accept triggers one follow-up sync path rather than one sync per expense.
6. Verify raw SMS never reaches GitHub sync, exported records, or shared expense data.
7. Verify docs are updated and Android builds still succeed after platform-positioning changes.

**Decisions**

- Use regex-first parsing and explicitly avoid reviving the PR 43 ML/TFLite path.
- Use Kotlin with Expo Modules API for Android-native SMS access.
- Ship the feature as review-first, not silent auto-create.
- Keep SMS-derived raw metadata and dedupe fingerprints local-only; do not sync them to GitHub.
- Lock the first historical bootstrap window to 7 days.
- Treat Android-only support as a soft de-scope immediately and a hard code/config removal later.

**PR 43 Findings**

- PR 43 was Android-only, review-first, and kept raw SMS local.
- PR 43 scoped itself to new incoming SMS after enablement and excluded historical inbox scans.
- PR 43 converged on on-device ML with TFLite and removed regex-based parser files.
- PR 43 also excluded auto-add, on-device retraining, and backend processing.
- The current plan keeps the privacy and UX constraints from PR 43 while explicitly changing the parser strategy and historical-scan scope.

**Further Considerations**

1. The 7-day bootstrap window is a deliberate v1 product limit, not a technical limit. Extend it only after measuring review noise, parse quality, and permission acceptance.
2. Category inference should remain low-confidence and user-editable, with "Other" or the user's default category as the safe fallback.
3. If bundled models are ever revisited later, document the Metro static-asset constraints that broke the prior TFLite path before any implementation work resumes.
