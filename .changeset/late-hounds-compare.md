---
"expense-buddy": minor
---

feat: multi-provider sync architecture (ADR-009)

- Add provider framework with SyncProvider interface, factory registry, credential store, and per-provider state store
- Add GitHub provider wrapping existing sync functions under the SyncProvider interface
- Add Google Drive provider using REST Drive API v3 with appDataFolder archive and stale-write detection
- Refactor XState sync machine to receive provider via input, with new states for reconciliation flow and error-code-based auth detection
- Add queue compaction with per-provider watermarks — compaction excludes non-reconciled providers
- Add Settings UI for multi-provider management: add/remove/activate, connection testing, reconciliation status badges
- Add storage migration from old single-provider config to multi-provider format (idempotent, runs at startup)
- Update bug reporting to look up GitHub credentials from provider store regardless of active provider
- Add activation UX: first-sync indicator on sync button, auto-sync disabled until provider is reconciled
- Add Google OAuth client ID configuration in app.config.js and runtime-config.ts
- Add incremental write strategy and lazy DeferredProvider resolution for sync
- Redesign Settings sync/dashboard section: replace +Add buttons with icon actions for SMS import and sync
- Add swipeable expense rows with icon-only swipe actions and consistent swipe direction
- Add swipeable provider cards in Settings with right-swipe to reveal edit/delete/test actions
- Add icon-only action buttons with long-press tooltips on provider cards
- Open GitHub config in modal on Edit instead of inline form
- Hide Add buttons for already-configured providers
- Add platform guards for native module crashes in Expo Go
- Align dependency versions to match Expo SDK supported versions
- Replace Google Drive zip archive with per-year JSON files for incremental sync
- Replace browser-based Google OAuth with native Android GoogleSignInClient (expo-module)
- Add Cloudflare Worker for server-side Google OAuth token exchange + refresh (client secret never in APK)
- Add CI workflow to deploy token exchange Worker on merge to main
- Update all documentation (README, ARCHITECTURE, PRIVACY) for multi-provider sync and native OAuth
