---
"expense-buddy": minor
---

feat: multi-provider sync architecture (ADR-009)

- Add provider framework with SyncProvider interface, factory registry, credential store, and per-provider state store
- Add GitHub provider wrapping existing sync functions under the SyncProvider interface
- Add Google Drive provider (Android-only) using REST Drive API v3 with appDataFolder archive and stale-write detection
- Refactor XState sync machine to receive provider via input, with new states for reconciliation flow and error-code-based auth detection
- Add queue compaction with per-provider watermarks — compaction excludes non-reconciled providers
- Add Settings UI for multi-provider management: add/remove/activate, connection testing, reconciliation status badges
- Add storage migration from old single-provider config to multi-provider format (idempotent, runs at startup)
- Update bug reporting to look up GitHub credentials from provider store regardless of active provider
- Add activation UX: first-sync indicator on sync button, auto-sync disabled until provider is reconciled
- Add Google OAuth client ID configuration in app.config.js and runtime-config.ts
- Update all documentation (README, ARCHITECTURE, PRIVACY) for multi-provider sync
