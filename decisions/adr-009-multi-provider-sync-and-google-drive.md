# ADR-009: Multi-Provider Sync with Google Drive Backups

**Date:** 2026-06-03  
**Status:** Amended — Native Android OAuth replaces browser flow (2026-06-05)  
**Author:** Planning draft via GitHub Copilot

> **Amendment (2026-06-05):** The initial design used `expo-auth-session` with a custom `myapp://` redirect URI. Google's OAuth 2.0 policy now rejects custom-scheme redirect URIs for Android apps. The auth layer was replaced with a native Android `GoogleSignInClient` flow via the `expense-buddy-google-auth` Expo module. The browser fallback (`expo-auth-session`) is retained for non-Android platforms but is not used in production (Drive sync is Android-only).

---

## Goal

Design a single, user-visible sync system that supports:

- support for two sync providers (GitHub and Google Drive), at most one configured per kind
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

**Product constraint: at most one provider per kind.** The supported kinds are `github` and `google_drive`. Future providers (e.g., iCloud, Dropbox) will add new kinds, not duplicate existing ones. This means at most one GitHub configuration and one Google Drive configuration can exist simultaneously. The settings UI prevents adding a second provider of an already-configured kind.

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

`manifest.json` is the authoritative remote metadata root. A light preflight (`files.get` with `fields=version,modifiedTime`) tells the provider whether to re-download the whole archive or skip. No per-file SHA checks are done at the Drive API level.

Archive size must be bounded. The native zip module currently reads and writes the entire archive in memory as base64. For large histories (years of daily CSVs), a temp-file or streaming boundary must be added to the native module so archive I/O does not OOM on mid-tier Android devices. The temp-file path is an **MVP-blocking requirement** — the current all-in-memory approach is acceptable for development and testing but must be replaced before the Google Drive provider ships to production. The `archive-codec.ts` TypeScript boundary is designed so this change is invisible to callers.

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

Introduce a `SyncProvider` interface below the sync engine and above provider-specific auth and remote APIs. The abstraction models a logical snapshot, not raw transport details.

The interface defines:

- `readSnapshot()`: fetch the full remote snapshot or return null
- `writeSnapshot(snapshot, lastKnownRevision)`: write the full snapshot with optimistic concurrency
- `testConnection()`: validate auth and remote access
- `getStatus()`: lightweight UI-facing status

Provider implementations are registered into a module-level registry (`provider-registry.ts`) — no DI container library needed. Since there is at most one provider per kind, the registry maps `SyncProviderKind` directly to a factory that produces a config-bound instance via `createProvider(config)`. Each instance carries the specific config (repo/branch, archive filename) from the settings.

All provider errors are normalized into `SyncProviderError` with a shared error code enum (`AUTH_MISSING`, `AUTH_EXPIRED`, `CONFLICT`, `RATE_LIMITED`, etc.) so the XState machine, retry logic, and settings UI are provider-agnostic.

The merge engine remains shared. Credentials are stored in a separate `CredentialStore` interface backed by `expo-secure-store`, keyed by `credentialId` — provider configs carry only a `credentialId` reference, never raw secrets.

GitHub and Google Drive differ in remote transport, but both map to the same logical snapshot shape.

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

The only required behavioral adjustment is that bug reporting must look for the configured GitHub provider directly rather than assuming the active sync provider is GitHub.

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
  credentialId: string
}

interface GitHubProviderConfig extends BaseSyncProviderConfig {
  kind: "github"
  repo: string
  branch: string
}

interface GoogleDriveProviderConfig extends BaseSyncProviderConfig {
  kind: "google_drive"
  accountEmail?: string
  archiveFileName: string
}

interface SyncProvidersState {
  activeProviderId: string | null
  providers: Array<GitHubProviderConfig | GoogleDriveProviderConfig>
}
```

Notes:

- provider IDs must be stable so caches and per-provider metadata can be namespaced cleanly
- **provider descriptors must not carry secrets directly.** Each provider references a `credentialId` that maps into secure storage. This keeps provider config serializable and prevents credential leakage through store snapshots, state persistence, or logging
- GitHub credentials and Google OAuth tokens are stored separately in secure storage, keyed by `credentialId`
- Google access and refresh tokens must support refresh flows; the provider implementation should handle token refresh transparently
- GitHub can remain configured even when inactive so bug reporting can still use it

### Credential store model

Secrets are separated from provider config via a `credentialId` indirection. A dedicated credential store service manages the mapping.

```ts
interface CredentialEntry {
  credentialId: string
  kind: "github_pat" | "google_oauth"
  data: Record<string, string>
  createdAt: string
  updatedAt: string
}

interface CredentialStore {
  get(credentialId: string): Promise<CredentialEntry | null>
  save(
    credentialId: string,
    entry: Omit<CredentialEntry, "createdAt" | "updatedAt">
  ): Promise<void>
  delete(credentialId: string): Promise<void>
}
```

Google OAuth tokens require refresh support. The credential store stores both the access token and refresh token. A dedicated token refresh function scoped to the `google_oauth` kind handles transparent refresh before every provider operation. If refresh fails, the provider surfaces an `AUTH_EXPIRED` error to trigger re-authentication.

Backing store: `expo-secure-store` keyed by `credential.${credentialId}`. This keeps per-credential entries isolated, serializable, and outside AsyncStorage (which is unencrypted).

**Platform scope:** Google Drive sync is Android-only for MVP — the native archive module (`ArchiveUtils.kt`) and Drive API access require the Android platform. The credential store on Android uses `expo-secure-store`. Web fallback (where `secure-storage.ts` degrades to AsyncStorage) is acceptable for the MVP because Google Drive sync is not available on web. If web support is added later, credential storage on that platform must be re-evaluated.

### Shared error model

All provider errors are normalized into a single error type so the XState machine, retry logic, and settings UI can render provider-agnostic error states.

```ts
class SyncProviderError extends Error {
  constructor(
    readonly code: SyncProviderErrorCode,
    readonly providerKind: SyncProviderKind,
    message: string,
    readonly retryable: boolean
  ) {
    super(message)
  }
}

type SyncProviderErrorCode =
  | "AUTH_MISSING" // credential not found in store
  | "AUTH_EXPIRED" // token expired and refresh failed
  | "AUTH_INVALID" // token rejected by remote
  | "PERMISSION_DENIED" // remote rejected the operation
  | "NOT_FOUND" // remote resource does not exist
  | "CONFLICT" // optimistic concurrency check failed
  | "RATE_LIMITED" // remote API quota exceeded
  | "NETWORK" // transient network failure
  | "REMOTE_ERROR" // remote returned an unexpected error
  | "ARCHIVE_CORRUPT" // zip or manifest integrity check failed
  | "ARCHIVE_TOO_LARGE" // archive exceeds current memory threshold
```

Each provider maps its own transport errors into these codes. The mapping matches each provider's real API error surface, not a synthetic heuristic:

- GitHub:
  - `401` → `AUTH_INVALID` (bad or expired token)
  - `403` with `x-ratelimit-remaining: 0` or body message containing `"rate limit"` → `RATE_LIMITED`
  - `403` with other messages → `PERMISSION_DENIED`
  - `404` → `NOT_FOUND`
  - `409` → `CONFLICT`
  - `422` with `"sha"` in body → `CONFLICT` (stale blob SHA)
  - Network errors (`FetchError`, `TypeError`, DNS failures) → `NETWORK`
  - Unexpected HTTP status or malformed response → `REMOTE_ERROR`

- Google Drive:
  - `401` → `AUTH_EXPIRED` (triggers token refresh then retry)
  - `403` with `rateLimitExceeded` reason → `RATE_LIMITED`
  - `403` with other reasons → `PERMISSION_DENIED`
  - `404` → `NOT_FOUND`
  - `429` → `RATE_LIMITED`
  - `5xx` → `NETWORK` (retryable)
  - Version mismatch during pre-upload check → `CONFLICT`
  - Zip parse failure or manifest hash mismatch → `ARCHIVE_CORRUPT`

The `retryable` flag drives auto-sync retry behavior. `NETWORK`, `RATE_LIMITED`, and `CONFLICT` are retryable. `AUTH_*`, `PERMISSION_DENIED`, and `ARCHIVE_CORRUPT` are not.

### Remote revision model

The logical snapshot uses a discriminated revision type — not a plain string — because GitHub and Drive have fundamentally different revision semantics.

```ts
interface SyncSnapshot {
  manifest: {
    version: number
    generatedAt: string
    appVersion: string
    files: Array<{ path: string; hash: string }>
  }
  files: Record<string, string>
  remoteRevision: RemoteRevision | null
}

type RemoteRevision =
  | { kind: "git_sha"; sha: string }
  | { kind: "drive_version"; fileId: string; version: number }

// Semantics:
// - git_sha: compare by equality (same SHA = same content)
// - drive_version: monotonically increasing integer.
//   Higher version always means newer content.
//   The provider stores fileId so subsequent preflights
//   can call files.get on the correct Drive file.
```

The `SyncProvider` interface returns `RemoteRevision | null` from `readSnapshot`. On write, the caller passes back the revision it read so the provider can detect whether the remote has advanced between read and write. Detection is app-side (re-fetch remote revision before upload) rather than server-enforced because the Google Drive API does not expose a compare-and-swap precondition for `files.update`.

### Provider abstraction: SyncProvider interface

Introduce a `SyncProvider` interface that all sync backends implement. This is the core abstraction boundary — the XState machine, merge engine, and settings UI interact with the interface, not with provider-specific modules.

Provider instances are **config-bound**: each instance is created for a specific configured provider (specific repo/branch or specific archive). This is why the methods take no `config` parameter — the config is baked in at construction time.

```ts
interface SyncProvider {
  /** Human-readable label (e.g. "GitHub", "Google Drive") */
  readonly kind: SyncProviderKind

  /** The provider ID this instance is bound to */
  readonly providerId: string

  /** Validate that auth and remote config are usable */
  testConnection(): Promise<ConnectionTestResult>

  /** Fetch the full remote snapshot.
   *  Returns null if no remote data exists yet. */
  readSnapshot(): Promise<SyncSnapshot | null>

  /** Write the full remote snapshot.
   *  Accepts the remoteRevision from the last readSnapshot call
   *  so the provider can detect whether the remote advanced since read. */
  writeSnapshot(
    snapshot: SyncSnapshot,
    lastKnownRevision: RemoteRevision | null
  ): Promise<void>

  /** One-shot status check for UI display.
   *  Must be fast (cache-first, remote check only when needed).
   *  Guarantees: reports whether auth is valid and remote is reachable.
   *  Does NOT check whether remote data exists — that requires a
   *  readSnapshot call and is handled by the initial reconciliation flow.
   *  Does NOT do a full sync. */
  getStatus(): Promise<ProviderStatus>
}

type ConnectionTestResult =
  | { ok: true; label: string }
  | { ok: false; error: SyncProviderError }

interface ProviderStatus {
  connected: boolean
  lastSyncTime: string | null
}
```

Key design constraints:

- The interface operates at the **snapshot level**, not the file level. A snapshot is all-or-nothing. This matches GitHub's tree-level commit and Drive's single-archive model without favoring either.
- `readSnapshot` returns `null` for "no remote data" — this is the signal the machine uses to enter initial reconciliation.
- `writeSnapshot` receives `lastKnownRevision` for optimistic concurrency. The provider checks whether the remote has advanced since the read and throws `CONFLICT` if so.
- `getStatus` is a lightweight call: cache-first, remote check only when the cache is stale. For Drive this is `files.get` with `fields=version` (one API call, ~100ms). For GitHub this is a PAT validation call to `https://api.github.com/user` (cached with a TTL). The contract is "faster than a sync, good enough for UI display." No repo metadata, branch-head checks, or data-existence probes are done — those are sync operations, not status checks. `remoteDataExists` is intentionally absent from `ProviderStatus` because determining it requires a full remote probe for GitHub; the initial reconciliation machine states handle that signal.
- The interface deliberately omits per-file operations, raw API access, and auth flows — those are provider-internal.

### Provider registry (factory-based)

Provider implementations are registered as **factories**, not singletons. Since there is at most one configured provider per kind, the registry maps `SyncProviderKind` → `SyncProviderFactory`. Each call to `createProvider(config)` produces a config-bound instance carrying the specific settings (repo/branch for GitHub, archive filename for Google Drive).

```ts
// services/sync/provider-types.ts — new factory type
interface SyncProviderFactory {
  readonly kind: SyncProviderKind
  create(config: GitHubProviderConfig | GoogleDriveProviderConfig): SyncProvider
}
```

```ts
// services/sync/provider-registry.ts
import type { SyncProvider, SyncProviderFactory } from "./provider-types"

const factories = new Map<SyncProviderKind, SyncProviderFactory>()

export function registerFactory(factory: SyncProviderFactory): void {
  factories.set(factory.kind, factory)
}

export function createProvider(
  config: GitHubProviderConfig | GoogleDriveProviderConfig
): SyncProvider {
  const factory = factories.get(config.kind)
  if (!factory) throw new Error(`No factory registered for kind: ${config.kind}`)
  return factory.create(config)
}
```

Registration happens at module load time:

```ts
// services/sync/github-provider.ts
class GitHubProvider implements SyncProvider { ... }
registerFactory({
  kind: "github",
  create: (config) => new GitHubProvider(config as GitHubProviderConfig, credentialStore),
})
```

For testing, `registerFactory` can be called with a mock factory that returns `MockSyncProvider` instances — no `jest.mock` import-order dependency needed.

When a provider is activated, the StoreProvider creates a fresh instance:

```ts
// store-provider.tsx (conceptual)
const provider = createProvider(activeConfig)
syncActorRef = createActor(syncMachine, { input: { provider } })
```

The instance is not cached. Each activation creates a new config-bound provider. This is safe because all mutable state lives in provider-scoped metadata and the credential store, not on the provider instance.

### Provider-scoped sync metadata

All sync metadata must move from global keys to provider-scoped keys.

This includes:

- last sync timestamp from `services/sync-direction.ts`
- file hash cache from `services/hash-storage.ts`
- remote SHA cache from `services/remote-sha-cache.ts`
- sync queue ack watermark from `services/sync-queue.ts`
- dirty-day and deleted-day state from `services/expense-dirty-days.ts`
- any future remote revision or snapshot fingerprints

Without provider-scoped queue and dirty-day state, switching providers would incorrectly carry un-acked local operations from the previous provider into the new provider's timeline. Each provider must track which local changes it has successfully pushed.

Suggested keying model:

- `sync.providers.<providerId>.lastSyncTime`
- `sync.providers.<providerId>.fileHashes`
- `sync.providers.<providerId>.remoteIndex`
- `sync.providers.<providerId>.queueWatermark`
- `sync.providers.<providerId>.dirtyDays`
- `sync.providers.<providerId>.deletedDays`
- `sync.providers.<providerId>.initialReconciliationComplete`

Without this namespacing, switching from GitHub to Google would incorrectly reuse old local sync state.

### Provider abstraction and service layout

Refactor the sync services into shared orchestration plus provider implementations.

Suggested layout:

```text
services/
  sync/
    provider-types.ts         -- SyncProvider interface, SyncProviderFactory,
                                  SyncSnapshot, RemoteRevision, SyncProviderError,
                                  CredentialStore
    provider-registry.ts      -- factory registry, registerFactory / createProvider
    credential-store.ts       -- expo-secure-store backed CredentialStore implementation
    sync-config-store.ts      -- persists/loads SyncProvidersState
    provider-state-store.ts   -- persists provider-scoped metadata
    github-provider.ts        -- implements SyncProvider for GitHub
    google-drive-provider.ts  -- implements SyncProvider for Google Drive
    snapshot-codec.ts         -- shared logical file model
    archive-codec.ts          -- TypeScript boundary over native archive utility
```

Responsibilities:

- `provider-types.ts`: `SyncProvider` interface, `SyncProviderFactory`, `SyncSnapshot`, `RemoteRevision`, `SyncProviderError`, `CredentialStore` interface
- `provider-registry.ts`: module-level factory registry mapping `SyncProviderKind` → `SyncProviderFactory`; `registerFactory` and `createProvider(config)` exports
- `credential-store.ts`: concrete `CredentialStore` backed by `expo-secure-store`, keyed by `credential.${credentialId}`
- `github-provider.ts`: implements `SyncProvider` for GitHub REST API; config-bound (repo/branch from the config passed to factory)
- `google-drive-provider.ts`: implements `SyncProvider` for Google Drive; config-bound (archive filename, account from the config passed to factory)
- `snapshot-codec.ts`: `SyncSnapshot` model and serialization utilities
- `archive-codec.ts`: TypeScript boundary over `zipTextEntriesAsync` / `unzipTextEntriesAsync`; used by `google-drive-provider.ts`

Existing shared sync logic to preserve as much as possible:

- merge engine
- sync queue reconciliation
- settings merge behavior
- dirty day handling

The XState sync machine is updated (see section below) but its state-handling logic — conflict resolution, retry, the merge cycle — stays shared.

### Logical snapshot model

The shared remote model should describe the same logical content regardless of provider.

```ts
interface SyncSnapshot {
  manifest: {
    version: number
    generatedAt: string
    appVersion: string
    files: Array<{ path: string; hash: string }>
  }
  files: Record<string, string>
  remoteRevision: RemoteRevision | null
}
```

The `remoteRevision` field uses the discriminated type defined earlier, not a plain string:

GitHub mapping:

- `files` map to repo files directly (daily CSVs + `settings.json`)
- `remoteRevision` is `{ kind: "git_sha", sha: "..." }` — the tree or commit SHA
- `null` remoteRevision means the repo has no sync data yet

Google Drive mapping:

- `files` map to entries inside `expense-buddy-backup.zip`
- `remoteRevision` is `{ kind: "drive_version", fileId: "...", version: 42 }` — uses the Drive file `version` field (monotonically increasing integer) as the stale-write detection signal. `fileId` is persisted so subsequent preflights call `files.get` on the correct file. `modifiedTime` alone is unreliable because clock skew makes it unsafe as a conflict-detection primitive.
- `null` remoteRevision means no archive exists in `appDataFolder`

### GitHub provider behavior

GitHub remains functionally the same from the user's perspective.

Internally it changes to implement the shared provider contract.

Expected behavior:

- native GitHub auth flow continues to work
- repo and branch configuration remain required
- logical daily CSV structure remains unchanged
- direct issue creation remains available whenever a GitHub provider is configured and authenticated

### Google Drive provider behavior

Google Drive provider implements the `SyncProvider` interface.

**Archive lifecycle (find vs create):**

1. On first `readSnapshot`, call `files.list?spaces=appDataFolder` with `q=name='expense-buddy-backup.zip'`
2. If a file is found: store its `id` and `version` in provider-scoped metadata for subsequent preflights
3. If no file is found: return `null` (no remote data) — `writeSnapshot` will create the archive
4. On `writeSnapshot` when no prior `fileId` exists: call `files.create` with `uploadType=media` and `parents=["appDataFolder"]`, persist the returned `id`
5. On subsequent calls: use the persisted `fileId` directly — skip the list call

**Preflight optimization:**

Before downloading the full archive, call `files.get` with `fileId` and `fields=version,modifiedTime`. Compare the returned `version` against the locally persisted `remoteRevision.version`. If unchanged, skip the download. This is the only Drive API call in the common case (no changes).

**Optimistic concurrency (app-side):**

The Google Drive API does not expose a server-enforced compare-and-swap precondition for `files.update`. Conflict detection is app-side:

- On `readSnapshot`: record the Drive file `version` value
- Before `writeSnapshot`: call `files.get(fileId, fields="version")` to check if the version has changed since the last `readSnapshot`
- If unchanged: proceed with the upload
- If changed: throw `SyncProviderError(CONFLICT, ...)` — the remote has advanced since our last read
- The caller (XState machine) decides how to handle the conflict: re-fetch + re-merge and retry the write, or surface to the user

This is not a race-free guarantee — a concurrent write between the version check and the upload could still go undetected. In practice, since this is a single-user app with no simultaneous write path from another device, the window is negligible. For the current single-user scope this is acceptable; if concurrent-device sync is added later, this two-phase check will need to be re-evaluated against the Drive API's then-current capabilities.

**Archive integrity:**

After unzipping, verify each file's content against the hash in `manifest.json`. Mismatches throw `ARCHIVE_CORRUPT`. This is application-level verification — not delegated to the Drive API.

**Token refresh:**

Before every Drive API call, check if the access token is expired. If expired, use the refresh token to obtain a new one via the Google OAuth endpoint. If the refresh fails (revoked or expired), throw `AUTH_EXPIRED` to trigger re-authentication via the OAuth flow.

**Drive API quota:**

`appDataFolder` operations are subject to a ~60 requests per 100 seconds per-user quota. The preflight-early-exit path (one `files.get` call) stays well within this. Full sync rounds (list + download + upload) are expected only on explicit user action or initial setup.

Google-specific notes:

- use hidden `appDataFolder`, not a visible folder in My Drive
- use a single archive object, not one Drive file per logical file
- prefer PKCE-based OAuth through a supported Expo or native flow
- auth errors surface through `SyncProviderError` — the same normalized error path as GitHub

### XState sync machine refactoring

The sync machine is the single consumer of the `SyncProvider` interface. It receives the active provider through XState v5's actor `input` mechanism, not through direct imports.

**Current architecture (single provider, hardcoded import):**

```
sync-machine.ts
  └─ fromPromise(() => gitStyleSync(config, ...))  ← direct import of github-sync
```

**Target architecture (provider-agnostic, interface-driven):**

```
StoreProvider (or hook)
  └─ reads the active provider config from settings
  └─ creates a config-bound instance: createProvider(activeConfig)
  └─ passes the instance as input to the sync machine actor

sync-machine.ts
  └─ fromPromise(({ input }) => {
       const provider: SyncProvider = input.provider
       const snapshot = await provider.readSnapshot()
       // shared merge, queue reconciliation, dirty-day tracking
       await provider.writeSnapshot(merged, snapshot.remoteRevision)
     })
```

The machine actor is re-created when the active provider changes. The `StoreProvider` detects `activeProviderId` changes and tears down the old actor, creates a new one with the new provider as input:

```ts
// store-provider.tsx (conceptual)
const activeConfig = settingsStore.state.syncProviders.providers.find(
  (p) => p.id === settingsStore.state.syncProviders.activeProviderId
)
const provider = createProvider(activeConfig)
syncActorRef = createActor(syncMachine, { input: { provider } })
```

**Machine states (updated):**

```
idle
  └─ syncing
       └─ provider.readSnapshot()
       └─ merge engine
       └─ provider.writeSnapshot()
       └─ conflict? → conflict / resolve → pushing
       └─ success / error / inSync
```

The machine's `unifiedSync` actor is parameterized. It calls `provider.readSnapshot()` and `provider.writeSnapshot()` generically. The merge engine, queue reconciliation, dirty-day tracking, and conflict resolution logic remain shared — they operate on the `SyncSnapshot` data model, not on provider internals.

**Error handling in the machine:**

The `fromPromise` actor catches `SyncProviderError`. The machine transitions to:

- `error` with `retryable: false` → surface to user, do not auto-retry
- `error` with `retryable: true` → surface to user but allow auto-sync retry on next interval

The `authStatus` field on the current sync result type is replaced by the `SyncProviderErrorCode` enum. The machine no longer checks for HTTP 401/403 directly.

### AwaitingInitialReconciliation machine state

The ADR-009 switching semantics (section 5) require dedicated machine states. The current `idle → syncing → conflict/success/error` model is insufficient because:

- the machine must prevent auto-sync from running on a newly activated provider
- the machine must present different first-sync options (initialize remote, download, reconcile)
- the machine must flag that reconciliation is pending even when local and remote are empty

**New machine states:**

```
idle
  └─ awaitingInitialReconciliation  ← auto-sync blocked
       └─ (user action: Sync Now)
       └─ reconcilingFirstSync
            └─ provider.readSnapshot()
            └─ if null and no local data → done (nothing to sync)
            └─ if null and local data exists → prompt initialize remote
            └─ if snapshot exists and no local data → prompt download
            └─ if both exist → full merge
            └─ on success → set initialReconciliationComplete = true
            └─ on error → stay in awaitingInitialReconciliation
  └─ syncing                         ← auto-sync allowed
       └─ (standard sync flow)
```

**`awaitingInitialReconciliation`:**

- The provider enters `awaitingInitialReconciliation` when activated with no prior sync metadata for that provider on this device
- User must tap Sync Now to transition to `reconcilingFirstSync`
- The machine enforces that auto-sync events are no-ops while in `awaitingInitialReconciliation`
- After `reconcilingFirstSync` completes successfully, the machine writes `initialReconciliationComplete: true` to provider-scoped metadata and transitions to `idle` — auto-sync becomes eligible

**Queue and dirty-day state on first sync — explicit product decision:**

> **Decision:** Local edits follow the device, not the provider. When a user switches providers, all pending local edits (queued ops, dirty days) are carried forward and synced to the newly activated provider on first reconciliation.

Rationale: The current queue (`services/sync-queue.ts`) enqueues operations without provider scoping — a local expense edit is a generic mutation. If queued ops were discarded on switch, the user would silently lose edits made while offline or between syncs. If they were drained first, the old provider would need to be reachable. Carrying them forward is the only option that never loses data and works offline.

Implications that users should be aware of:

- Switching from GitHub to Drive will push all un-acked local edits to Drive as part of the first merge, even if those edits were conceptually "for" the GitHub timeline
- The old provider's remote state is not updated when the user switches away — pending edits are applied to the new provider, not flushed to the old one
- If the user switches back to the old provider later, its remote state will be stale by the delta of what was carried forward. The next reconciliation with that provider will merge normally (it sees the old remote snapshot plus all local data)

Implementation:

- The sync queue watermark starts at zero for the newly activated provider (no ops acked by this provider yet)
- Dirty-day and deleted-day state is initialized fresh for this provider
- On reconciliation, the merge engine fetches the remote snapshot and merges with **all** local data (not filtered by dirty days), then writes the full merged result
- The sync queue reconciliation runs on top of the merge result — it applies un-acked ops regardless of which provider originally queued them
- After the first successful sync, the new provider's watermark advances normally and future edits are tracked per-provider

This ensures queued ops are **not discarded** on provider switch. The per-provider watermark prevents replay after the first successful sync.

**Migration mechanics (existing users):** The current sync queue stores only pending operations and physically deletes them after successful ack. There is no persisted watermark — remaining queue entries at migration time are exactly the operations that have not yet been pushed anywhere. Migration follows these rules:

1. The migrated GitHub provider's queue watermark starts at the position before the earliest remaining entry (i.e., all existing queue entries are considered pending for GitHub). They are NOT treated as "already known" — assuming that would drop real unsynced local changes. The first post-migration GitHub sync will push them.
2. Dirty-day and deleted-day state migrates as GitHub's initial state — no data is discarded.
3. No queue flushing or pre-migration sync is required. Migration is safe and offline-friendly.
4. If Google Drive is added later, its watermark starts at the same position as GitHub's migrated watermark. Existing queue entries present at migration time are **not** replayed against Drive. They are treated as "pre-migration history" — they predate the multi-provider model and were queued under GitHub-only assumptions.
5. After migration, new local edits enqueued post-migration **do** follow the "local edits follow the device" rule. This means pre-migration history and post-migration pending edits have different semantics:
   - **Pre-migration history** (ops that existed in the queue at migration time): only sync to GitHub, the original provider.
   - **Post-migration pending edits** (ops enqueued after the provider model is active): sync to whichever provider is active when they are acked.
6. The queue data structure itself does not change. The `providerStateStore` holds the per-provider watermark values. The sync queue reconciliation logic filters operations against the active provider's watermark at runtime — no physical queue split is needed.
7. **Compaction rule changes:** The current runtime physically deletes acked operations from the queue after each successful sync (`clearSyncOpsUpTo`). With per-provider watermarks, the delete boundary advances to the minimum watermark across all providers that have completed initial reconciliation. Providers still in `awaitingInitialReconciliation` do not block compaction — they will reconcile against the full local dataset when activated, so historical queue entries are not needed for them. If only GitHub is configured (or all providers are reconciled), behavior is identical to today: delete on ack.

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

- check if a GitHub provider is configured (at most one, per the product constraint)
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

**Queue migration** follows the mechanics described in the "Queue and dirty-day state on first sync" section: the migrated GitHub provider's watermark starts before the earliest remaining queue entry — all existing pending ops are treated as unsynced and will be pushed on the first post-migration GitHub sync. No queue flushing or data loss occurs. Dirty-day and deleted-day state migrates alongside.

### Tests and verification

This change touches core sync behavior and needs broad test coverage.

Required test areas:

- provider config migration
- provider-scoped metadata reads and writes
- switching active providers
- initial reconciliation required state
- GitHub provider parity with current behavior
- Google provider archive encode and decode
- stale-write detection for Google Drive uploads
- settings screen behavior with multiple configured providers
- bug-report lookup when GitHub is configured but inactive
- auto-sync gating after provider activation

Property tests should remain around merge behavior and settings serialization. Provider-specific integration tests should cover snapshot parity across GitHub and Google.

Archive-specific test areas:

- zip roundtrip with realistic file counts (hundreds of daily CSVs)
- base64 size overhead measurements
- concurrency precondition rejection and retry behavior
- archive corruption and error recovery

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
- the XState machine must be refactored to receive the provider through actor input instead of direct imports
- the provider interface (`SyncProvider`) introduces an abstraction layer that must be kept stable across provider additions
- secrets management requires a new `CredentialStore` abstraction with cross-provider token lifecycle handling

## Rejected alternatives

1. **Keep GitHub-only sync**

Rejected because Google Drive backup is a better fit for mainstream users and the product goal explicitly includes it.

2. **Support only one configured provider total**

Rejected because users should be able to keep GitHub configured for issue reporting or future switching while using Google Drive as the active sync backend. The actual constraint is one provider per kind, not one provider total.

3. **Allow multiple active providers**

Rejected because active-active sync turns the problem into multi-remote distributed reconciliation and creates too much product and implementation complexity.

4. **Store Google Drive files individually instead of as a zip archive**

Rejected because a single hidden archive is a better fit for `appDataFolder`, reduces Drive API chatter, and preserves the current logical structure without exposing provider-specific file management to users.

5. **Move the entire sync engine to Kotlin**

Rejected because the orchestration and merge logic are already well established in TypeScript, and zipping is too narrow a reason to rewrite the whole stack in Android-native code.

6. **Use a full DI container library (tsyringe, inversify, awilix)**

Rejected because the codebase uses module-level singletons with `jest.mock` for testing — not constructor injection or container-managed lifetimes. Introducing a DI container would be an additional dependency and a new architectural convention for one abstraction boundary. A module-level factory registry (`SyncProviderFactory` with `create(config)`) achieves the same decoupling with zero new dependencies and fits the existing code style.

## Open questions

- ~whether archive packing and unpacking should stay in JS or move behind a small native helper~
  **Resolved:** Native Expo module (committed in `6774a58`). The TypeScript boundary in `services/archive-utils.ts` wraps `zipTextEntriesAsync` and `unzipTextEntriesAsync` behind a common interface.
- exact Google OAuth library choice for Expo native and web compatibility
- ~whether one GitHub provider should be supported or whether multiple GitHub repos should be allowed long term~
  **Resolved:** At most one provider per kind. Supported kinds are `github` and `google_drive`. Future providers add new kinds, not duplicates. This resolves the bug-report ambiguity — there is at most one GitHub credential to use.
- ~how much remote metadata from Google Drive should be persisted locally beyond revision and modified time~
  **Resolved:** Persist the Drive file `version` as the stale-write detection signal. `modifiedTime` is retained for UX display only. No additional metadata is needed.
- ~how first-sync after activation should handle pending queued operations from a previous provider~
  **Resolved:** Queued ops are retained and applied during the first merge. The per-provider queue watermark prevents replay after success. See "Initial reconciliation state machine" section.
- ~what is the maximum reasonable archive size, and at what threshold does the native module need a temp-file path instead of all-in-memory base64~
  **Decision:** This is an MVP-blocking item, not a post-launch optimization. The current native module (`ArchiveUtils.kt`) reads and writes the entire archive in memory as base64, which means the same data exists simultaneously in native heap and the JS runtime heap (~2x memory). For a user with 3+ years of daily expense CSV files (~1100 files at ~200 bytes each = ~220 KB of content), the base64 zip overhead pushes this toward several MB in memory — safe on modern devices but risky on mid-tier Android with limited heap. The temp-file or streaming path must be added to the native module before the Google Drive provider ships to production. The `archive-codec.ts` TypeScript boundary is designed so this change is invisible to callers. The module interface (`zipTextEntriesAsync` / `unzipTextEntriesAsync`) can switch to temp-file internally without changing its TypeScript signature.

## Related

- ADR-001: XState Sync State Machine (machine refactored to consume `SyncProvider` interface through actor input)
- ADR-008: On-device structured logging with bug-report integration (bug report flow updated to find GitHub credential by kind)
- Native archive utility module at `modules/expense-buddy-utils/` (committed in `6774a58`)
