# ADR-009: Multi-Provider Sync with Google Drive Backups

**Date:** 2026-06-03  
**Status:** Research and planning draft  
**Author:** Planning draft via GitHub Copilot

---

## Goal

Design a single, user-visible sync system that supports:

- multiple configured sync providers
- exactly one active sync provider at a time
- the existing GitHub sync flow
- a new Google Drive sync flow using hidden `appDataFolder` storage
- a revamped settings experience that makes provider choice and status clear
- no change to the current bug-report behavior beyond adapting it to the new provider model

This document describes the target end state in one shot, not an incremental rollout plan.

## Non-goals

- simultaneous active-active bidirectional sync across multiple providers
- automatic remote migration when switching providers
- changing the current issue-reporting UX beyond making it work when GitHub is configured but inactive
- moving the full sync engine from TypeScript to Kotlin
- introducing a backend service

## Context

The current sync architecture is GitHub-specific across several layers:

- `types/sync.ts` models only a GitHub token/repo/branch config
- `services/sync-config.ts` persists only one GitHub config
- `services/github-sync.ts` owns all remote read/write behavior
- `services/git-style-sync.ts`, `services/remote-fetch.ts`, `services/sync-direction.ts`, and `services/auto-sync-service.ts` call GitHub-specific APIs directly
- `stores/settings-store.ts` and `stores/hooks/use-settings.ts` expose a single `syncConfig`
- `components/ui/settings/GitHubConfigSection.tsx` and `app/(tabs)/settings.tsx` assume GitHub is the only provider
- bug reporting in `app/(tabs)/settings.tsx` reuses the saved GitHub token directly when present

The current sync metadata is also global rather than provider-scoped:

- `services/hash-storage.ts`
- `services/remote-sha-cache.ts`
- `services/sync-direction.ts`

That global state is acceptable in a GitHub-only world, but incorrect once the app can switch between providers.

## Decisions

### 1. Provider model

The app will support multiple configured providers but only one active provider at a time.

Definitions:

- **Configured provider**: a provider with saved auth and remote configuration
- **Active provider**: the provider used by manual sync, auto-sync, sync status, and conflict resolution
- **Inactive provider**: remains configured and editable, but is not used for sync until activated

The app does not attempt active-active sync, mirroring, or remote-to-remote replication.

### 2. Google Drive storage model

Google Drive sync will store a single archive in the user's hidden Drive `appDataFolder`.

Archive shape:

- `manifest.json`
- daily CSV files using the same logical naming convention as GitHub sync
- `settings.json`

Recommended archive file name:

- `expense-buddy-backup.zip`

`manifest.json` will include:

- format version
- generated timestamp
- app version
- list of logical files in the archive
- content hashes for each logical file
- optional remote revision metadata needed for conflict detection

`appDataFolder` is the correct storage target because it is hidden, app-specific, and aligned with the intended backup/sync UX.

### 3. Sync engine ownership

The sync engine remains in TypeScript.

Reasons:

- the existing merge logic, queue reconciliation, XState machine, and settings integration already live in TypeScript
- moving the whole stack to Kotlin would require parallel iOS or web behavior anyway
- the provider problem is architectural, not Android-native
- zipping and unzipping are edge operations, not a reason to rewrite sync orchestration

Archive I/O will live in a small Android-native Expo module and be consumed through a TypeScript interface. This keeps archive work off the main JS implementation path without moving sync orchestration into Kotlin.

### 4. Unified provider abstraction

Introduce a provider abstraction below the sync engine and above provider-specific auth and remote APIs.

The abstraction should model a logical snapshot, not raw transport details.

Example responsibilities:

- load provider config
- save provider config
- clear provider config
- test connection
- read remote snapshot
- write remote snapshot
- expose remote revision metadata for optimistic concurrency
- normalize provider-specific auth errors into shared sync errors

The merge engine remains shared.

GitHub and Google Drive differ in remote transport, but they both map to the same logical snapshot shape.

### 5. Active provider switching semantics

Switching the active provider does not migrate or overwrite data automatically.

Rules:

- each provider has its own remote state
- each provider has its own local sync metadata
- activating a provider with no prior sync metadata on this device enters an **initial reconciliation required** state
- auto-sync must not run for a newly activated provider until one manual sync succeeds

Expected behaviors on first sync after activation:

- if local data exists and remote snapshot is empty: prompt to initialize the remote from local data
- if remote snapshot exists and local data is empty: allow download/restore from remote
- if both local and remote data exist and this device has never synced with that provider: fetch remote, run full merge, then require explicit manual sync completion before auto-sync is enabled for that provider

The app should treat provider switching as selecting a different remote history, not as a continuation of the previous provider's timeline.

### 6. Bug reporting behavior

Keep the current behavior conceptually unchanged:

- if GitHub is configured, create the issue directly using the saved GitHub credentials
- if GitHub is not configured, keep the current browser and clipboard fallback

The only required behavioral adjustment is that bug reporting must look for any configured GitHub provider, not only the active sync provider.

## Target user experience

The Settings sync section will become provider-oriented rather than GitHub-oriented.

Expected user-facing behavior:

- user can configure GitHub
- user can configure Google Drive
- user can keep both configured
- user chooses which one is active
- user sees provider-specific status and connection state
- user sees a clear warning when switching the active provider if the new provider has never been synced on this device
- user runs one manual sync to reconcile the newly active provider before auto-sync becomes eligible

## Detailed design

### Provider configuration model

Replace the single `syncConfig` model with a provider-aware structure.

Suggested shape:

```ts
type SyncProviderKind = "github" | "google_drive"

interface BaseSyncProviderConfig {
  id: string
  kind: SyncProviderKind
  label: string
  enabled: boolean
}

interface GitHubProviderConfig extends BaseSyncProviderConfig {
  kind: "github"
  token: string
  repo: string
  branch: string
}

interface GoogleDriveProviderConfig extends BaseSyncProviderConfig {
  kind: "google_drive"
  accountEmail?: string
  archiveFileName: string
  accessToken: string
  refreshToken: string
  tokenExpiry: string
}

interface SyncProvidersState {
  activeProviderId: string | null
  providers: Array<GitHubProviderConfig | GoogleDriveProviderConfig>
}
```

Notes:

- provider IDs must be stable so caches and per-provider metadata can be namespaced cleanly
- GitHub credentials remain stored securely
- Google access and refresh tokens must also be stored securely
- GitHub can remain configured even when inactive so bug reporting can still use it

### Provider-scoped sync metadata

All sync metadata must move from global keys to provider-scoped keys.

This includes:

- last sync timestamp from `services/sync-direction.ts`
- file hash cache from `services/hash-storage.ts`
- remote SHA cache from `services/remote-sha-cache.ts`
- any future remote revision or snapshot fingerprints

Suggested keying model:

- `sync.providers.<providerId>.lastSyncTime`
- `sync.providers.<providerId>.fileHashes`
- `sync.providers.<providerId>.remoteIndex`
- `sync.providers.<providerId>.initialReconciliationComplete`

Without this namespacing, switching from GitHub to Google would incorrectly reuse old local sync state.

### Provider abstraction and service layout

Refactor the sync services into shared orchestration plus provider implementations.

Suggested layout:

```text
services/
  sync/
    provider-types.ts
    provider-registry.ts
    sync-config-store.ts
    provider-state-store.ts
    github-provider.ts
    google-drive-provider.ts
    snapshot-codec.ts
    archive-codec.ts
```

Responsibilities:

- `github-provider.ts`: converts GitHub repo contents to and from the logical snapshot model
- `google-drive-provider.ts`: converts Drive archive contents to and from the logical snapshot model
- `snapshot-codec.ts`: shared logical file model
- `archive-codec.ts`: TypeScript boundary over the native archive utility module used by Google Drive

Existing shared sync logic to preserve as much as possible:

- XState sync machine
- merge engine
- sync queue reconciliation
- settings merge behavior
- dirty day handling

### Logical snapshot model

The shared remote model should describe the same logical content regardless of provider.

Suggested shape:

```ts
interface SyncSnapshot {
  manifest: {
    version: number
    generatedAt: string
    appVersion: string
    files: Array<{ path: string; hash: string }>
  }
  files: Record<string, string>
  remoteRevision?: string
}
```

GitHub mapping:

- `files` map to repo files directly
- `remoteRevision` can be the current tree or commit SHA

Google Drive mapping:

- `files` map to entries inside `expense-buddy-backup.zip`
- `remoteRevision` can be Drive file ID plus revision identifier or modified timestamp

### GitHub provider behavior

GitHub remains functionally the same from the user's perspective.

Internally it changes to implement the shared provider contract.

Expected behavior:

- native GitHub auth flow continues to work
- repo and branch configuration remain required
- logical daily CSV structure remains unchanged
- direct issue creation remains available whenever a GitHub provider is configured and authenticated

### Google Drive provider behavior

Google Drive provider responsibilities:

- authenticate the user with Google OAuth and offline access
- store and refresh tokens securely
- read the hidden archive from `appDataFolder`
- create the archive if it does not exist
- unpack the archive to the logical snapshot model
- repack the logical snapshot into a zip before upload
- use optimistic concurrency checks so stale local uploads do not blindly overwrite newer remote snapshots

Google-specific notes:

- use hidden `appDataFolder`, not a visible folder in My Drive
- use a single archive object, not one Drive file per logical file
- prefer PKCE-based OAuth through a supported Expo or native flow
- auth errors should surface through the same normalized sync error path as GitHub

### Settings UI changes

Replace the single GitHub accordion with a provider management UI.

Required changes:

- provider list with per-provider cards
- add-provider entry points for GitHub and Google Drive
- explicit active-provider indicator
- activate/deactivate actions
- provider-specific configuration areas
- shared sync controls below provider selection
- provider-specific connection status and error messaging
- clear warning when activating a provider that has not been reconciled on the device yet

Recommended Settings layout:

1. Sync overview and explanation
2. Active provider summary
3. Provider cards
4. Shared sync controls:
   - sync now
   - auto-sync
   - sync settings
5. Provider-specific advanced actions:
   - test connection
   - disconnect provider
   - reconnect auth

### Activation and stale-provider UX

When the user activates a different provider, the app must not silently assume either side is authoritative.

Required UX behavior:

- show that the newly active provider may contain old or unrelated data
- mark the provider as needing manual reconciliation
- disable provider auto-sync until that manual sync succeeds
- present a clearer first-sync state than the normal `Sync Now` button text

Recommended status text examples:

- `Needs first sync on this device`
- `Remote archive is empty`
- `Remote data found - manual reconciliation required`

### Auth and runtime configuration

The app currently carries GitHub OAuth runtime configuration in `app.config.js` and `constants/runtime-config.ts`.

Required additions:

- Google OAuth client configuration
- runtime validation for Google auth config
- secure token storage for Google tokens
- token refresh support

Potential dependency additions:

- `expo-auth-session` or an equivalent supported Google OAuth path

### Bug reporting integration changes

The bug report flow stays conceptually the same, but provider lookup changes.

Required logic changes:

- inspect configured providers for a valid GitHub credential set
- do not require GitHub to be the active sync provider
- continue to create issues directly when GitHub credentials exist
- preserve clipboard and browser fallback when GitHub is not configured

This keeps the current product behavior while removing the hidden assumption that sync and issue submission always share the same active backend.

### Storage migration

Existing users have one GitHub sync configuration and one global sync metadata set.

Migration requirements:

- migrate old single-provider config into the new provider list format as one GitHub provider
- set that migrated provider as active
- migrate global sync metadata into provider-scoped metadata for the migrated GitHub provider
- preserve current behavior for users who never add Google Drive

The migration must be idempotent and safe to re-run.

### Tests and verification

This change touches core sync behavior and needs broad test coverage.

Required test areas:

- provider config migration
- provider-scoped metadata reads and writes
- switching active providers
- initial reconciliation required state
- GitHub provider parity with current behavior
- Google provider archive encode and decode
- optimistic concurrency for Google uploads
- settings screen behavior with multiple configured providers
- bug-report lookup when GitHub is configured but inactive
- auto-sync gating after provider activation

Property tests should remain around merge behavior and settings serialization. Provider-specific integration tests should cover snapshot parity across GitHub and Google.

## Consequences

### Positive

- Google Drive sync becomes available without changing the user's logical backup structure
- the app becomes extensible for future providers
- GitHub remains supported for power users
- users can keep both providers configured and switch deliberately
- sync metadata correctness improves because state becomes provider-scoped
- bug reporting continues to work for GitHub-authenticated users even if Google Drive is the active sync backend

### Negative

- sync settings state becomes more complex
- provider switching introduces a new UX state that must be explained clearly
- Google OAuth and token refresh add auth complexity
- archive handling adds memory and error-surface considerations
- many current tests and types will need updates because `syncConfig` is no longer singular

## Rejected alternatives

1. **Keep GitHub-only sync**

Rejected because Google Drive backup is a better fit for mainstream users and the product goal explicitly includes it.

2. **Support only one configured provider at a time**

Rejected because users should be able to keep GitHub configured for issue reporting or future switching while using Google Drive as the active sync backend.

3. **Allow multiple active providers**

Rejected because active-active sync turns the problem into multi-remote distributed reconciliation and creates too much product and implementation complexity.

4. **Store Google Drive files individually instead of as a zip archive**

Rejected because a single hidden archive is a better fit for `appDataFolder`, reduces Drive API chatter, and preserves the current logical structure without exposing provider-specific file management to users.

5. **Move the entire sync engine to Kotlin**

Rejected because the orchestration and merge logic are already well established in TypeScript, and zipping is too narrow a reason to rewrite the whole stack in Android-native code.

## Open questions

- whether archive packing and unpacking should stay in JS or move behind a small native helper
- exact Google OAuth library choice for Expo native and web compatibility
- whether one GitHub provider should be supported or whether multiple GitHub repos should be allowed long term
- how much remote metadata from Google Drive should be persisted locally beyond revision and modified time

## Related

- ADR-001: XState Sync State Machine
- ADR-008: On-device structured logging with bug-report integration
