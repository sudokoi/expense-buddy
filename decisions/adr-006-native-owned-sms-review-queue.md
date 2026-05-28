# ADR-006: Native-Owned SMS Review Queue with Room-Based Persistence

**Date:** 2026-05-27 (last updated 2026-05-28 for Phase 3)
**Status:** Accepted — Phases 1–3 complete, Phase 4 (reliability logging) complete
**Author:** Planning draft via Opencode Deepseek v4 flash

---

## Context

The SMS import review queue currently has split ownership across three layers:

1. **JS XState store** — authoritative for in-memory state during a session
2. **AsyncStorage** (`sms_import_review_queue_state_v1`) — canonical on-disk queue snapshot written by JS
3. **Native SharedPreferences** (`expense_buddy_background_sms`) — mirror snapshot written by JS and independently mutated by the `SMS_RECEIVED` BroadcastReceiver

This split-brain architecture causes several production bugs:

- **Duplicates**: A manual scan starts building an `existingFingerprints` Set from the JS store, then an `SMS_RECEIVED` broadcast adds an item to native storage during the async scan gap. The JS scan never sees it and creates a second queue entry for the same SMS (TOCTOU race, `bootstrap.ts:153`).

- **Reappearing rejected items**: The native mirror write in `saveBackgroundSmsReviewQueueSnapshot` has an empty `catch` block that silently swallows errors. When the mirror write fails, native retains a stale `pending` item. On next init, `mergeReviewItems` sees the AsyncStorage `rejected` item and the native `pending` item. Before the status-priority fix (applied in an earlier changeset), timestamp could win. After the fix, the silent divergence still means the native store shows incorrect state to the BroadcastReceiver and notification system.

- **Concurrent persistence races**: XState store effects call `persistQueueState()` (AsyncStorage + native mirror) without serialization. Two concurrent effects can interleave: effect A reads old state, effect B reads old state, effect A writes new state, effect B writes — clobbering A's changes.

- **No write-level mutex**: `BackgroundSmsReviewQueueStore.upsertPendingItem()` in Kotlin reads the full snapshot, appends an item, and writes back — all outside any lock. Two `SMS_RECEIVED` broadcasts within milliseconds of each other can both read an empty queue, both append, and the second write overwrites the first.

- **Weak fingerprint collision**: The JS fingerprint uses a 32-bit custom hash (`hash |= 0`). The Kotlin fingerprint uses `Long.toString(absoluteValue, 36)`. These produce different hashes for the same SMS. Additionally, the JS fingerprint includes only sender + body + timeWindow while the Kotlin version does not include amount normalization. The same SMS passing through different paths generates different fingerprints, defeating cross-boundary dedupe.

- **Array-based storage is not idempotent**: Both JS and native store the queue as `List<T>`. Insert is `[...list, item]` — not idempotent. The same item inserted twice creates two entries. Fingerprint dedupe happens at read time as a post-processing step rather than at write time, so concurrent inserts that race past the dedupe check both succeed.

ADR-003 established the review-first staging boundary. ADR-005 added background SMS alerts with a native snapshot mirror. This ADR addresses the architectural gaps that emerged when those two systems interacted without a unified ownership model.

## Decision

Migrate the SMS review queue to a native-owned, Room-backed persistence model. JS becomes a UI projection layer and action dispatcher — it no longer owns queue state, handles dedupe, or runs persistence.

### New ownership boundaries

| Responsibility    | Owner  | Implementation                                            |
| ----------------- | ------ | --------------------------------------------------------- |
| Queue persistence | Native | Room database (`sms_review_queue` table)                  |
| Deduplication     | Native | `@PrimaryKey` on fingerprint; `OnConflictStrategy.IGNORE` |
| Queue mutations   | Native | Mutex-guarded repository methods                          |
| Event emission    | Native | `"onReviewQueueUpdated"` after any mutation               |
| State projection  | JS     | Snapshot-consumer; refetches on event                     |
| Action dispatch   | JS     | `approveReviewItemAsync(fingerprint)`, etc.               |

### Changes required

**Phase 1 — Immediate stabilization (no Room)**

1. **Unify fingerprint to SHA-256** in both JS (`createSmsImportFingerprint`) and Kotlin (`BackgroundSmsParser.createFingerprint`). Formula:

   ```
   sha256(
     lowercase(trim(sender)) |
     normalizedDecimal(amount) |
     timeWindow3min(timestamp) |
     collapseWhitespace(lowercase(body))
   )
   ```

   This ensures a given SMS always produces the same 64-character hex fingerprint regardless of which path processes it. The amount field is included explicitly as a normalized decimal (e.g. `"499.00"`) so that two parsers that extract different string representations still converge on the same fingerprint.

2. **Add `Mutex` to `BackgroundSmsReviewQueueStore`** wrapping all read–modify–write cycles. Use `kotlinx.coroutines.sync.Mutex` with `runBlocking` for the BroadcastReceiver path and `suspend` for TurboModule paths.

3. **Convert native storage from `List<ReviewItem>` to `Map<String, ReviewItem>`** keyed by fingerprint. Insert becomes `map[fp] = item` — idempotent by construction.

4. **Serialize JS persistence writes** with a sequential promise queue. Replace fire-and-forget `AsyncStorage.setItem` calls with a chain that guarantees at most one write is in-flight at any time.

**Phase 2 — Room migration**

5. **Add Room database** to `expense-buddy-background-sms`. Create:
   - `ReviewQueueEntity` (fingerprint PK, status: PENDING/APPROVED/REJECTED/DISMISSED/FAILED, importSource, timestamps, all parsed fields)
   - `SmsImportJournalEntity` (auto-id PK, fingerprint, source, action, timestamp, details)
   - `ReviewQueueDao` with insert-on-conflict-ignore, status update, pending-item query

6. **Build `SmsReviewQueueRepository`** wrapping DAO calls with `Mutex`-guarded transactional writes and structured logging.

7. **Migrate existing data**: On first launch after this update:
   - Read `lastScanCursor` from AsyncStorage (the old queue key)
   - Discard all existing queue entries across both AsyncStorage and SharedPreferences
   - Run a fresh scan using the preserved cursor as the `since` parameter
   - Insert new results into Room with `importSource = "BOOTSTRAP_SCAN"`
   - Remove AsyncStorage queue key and SharedPreferences queue snapshot key

   This means the user starts with a clean queue after the update, but the scan window is bounded by their last cursor — they do not re-process their entire inbox. If no cursor exists (first-ever scan), fall back to the default 7-day lookback.

**Phase 3 — Native parser extraction and JS cleanup**

8. **Strip JS queue ownership** from `sms-import-review-store.ts`:
   - Remove `mergeReviewItems()`, `persistQueueState()`, and the complex `initializeSmsImportReviewStore()` merge
   - Replace all `enqueue.effect(async () => persistQueueState(...))` with calls to native TurboModule APIs

9. **Expose new TurboModule APIs** on `ExpenseBuddyBackgroundSmsModule`:
   - `getPendingReviewQueueAsync()` → returns `ReviewQueueItem[]`
   - `approveReviewItemAsync(fingerprint: string)`
   - `rejectReviewItemAsync(fingerprint: string)`
   - `dismissReviewItemAsync(fingerprint: string)`
   - `insertPendingItemsAsync(items: ReviewQueueItem[])`

10. **Switch to event-driven sync**: Native emits `"onReviewQueueUpdated"` after any mutation. JS subscribes via `addListener`, refetches a fresh snapshot on each event. No incremental state mutation across the bridge.

11. **Extract parser to shared native module**: Move core regex parsing and fingerprint logic from `BackgroundSmsParser` (in `expense-buddy-background-sms`) to a new `SmsMessageParser` class in `expense-buddy-sms-import`. This eliminates the duplicate JS-side `parser.ts` and `fingerprint.ts` by:
    - Adding `scanAndParseMessagesAsync` to `ExpenseBuddySmsImportModule` — scans SMS and returns pre-parsed results with native fingerprints
    - Updating `BackgroundSmsParser` to delegate to `SmsMessageParser` for all regex/fingerprint logic, keeping only the Android `SmsMessage[]` → `SmsRawMessage` conversion
    - Adding `implementation project(":expense-buddy-sms-import")` to `expense-buddy-background-sms/build.gradle`
    - Simplifying `services/sms-import/bootstrap.ts` to call `scanAndParseMessages` instead of JS parser + fingerprint
    - Deleting `parser.ts`, `parser.test.ts`, `fingerprint.ts`, `fingerprint.test.ts` (JS regex/fingerprint code)
    - `payment-method-hints.ts` is kept — still used by `suggestion-resolver.ts` for downstream payment instrument matching
    - Module dependency: `expense-buddy-sms-import` owns `SmsMessageParser` (pure Kotlin, no Android framework dependencies). Both `ExpenseBuddySmsImportModule` and `BackgroundSmsParser` call into it. Tests: `SmsMessageParserTest` (30 tests) replaces JS parser + fingerprint tests.

**Phase 4 — Reliability**

11. **Add structured logging** to every native queue operation with tag `[SMS_QUEUE]`. Log fingerprint, action, source, and duration.

12. **Add import source metadata** (`MANUAL_SCAN`, `BOOTSTRAP_SCAN`, `SMS_RECEIVED`, `RETRY_JOB`) to every journal entry.

## Consequences

### Positive

- Queue is deterministic and idempotent: same SMS never creates duplicate entries regardless of concurrent access
- Queue survives app restarts, bridge timing issues, and background receiver races
- Dedupe is enforced at the persistence layer (Room PK using SHA-256 fingerprint), not as a post-processing step
- JS crashes or stale renders cannot corrupt queue state
- Background `SMS_RECEIVED` and foreground manual scans share one mutex — no TOCTOU gap
- Import journal enables debugging duplicate paths and tracking queue behavior in production
- SHA-256 fingerprint is collision-safe and consistent across JS and Kotlin
- Migration preserves the last scan window so users do not re-scan their full inbox

### Negative

- Adds Room as a dependency to `expense-buddy-background-sms` module (APK size increase ~100 KB)
- Existing queue data is discarded on migration (pending items that were not yet reviewed are lost; they will be re-created on rescan)
- JS store initialization must wait for native snapshot fetch (minor latency at startup)
- Testing needs changes: Room DAOs need in-memory test databases, TurboModule calls need mocking
- Existing `mergeReviewItems` tests become obsolete once JS drops ownership

## Rejected alternatives

1. **Authoritative-source merge hotfix** — Keep AsyncStorage as canonical source and treat native as a read-only supplement at init time only. Rejected because it does not address session-internal races: if a manual scan runs during a session, it still builds a stale `existingFingerprints` set and misses items the BroadcastReceiver added to native storage. Also does not fix the missing mutex, the weak fingerprint collision across JS/native boundaries, or concurrent persistence writes.

2. **Keep AsyncStorage and add a write-ahead log** — Add a WAL to serialize writes without moving to Room. Rejected because it still leaves the split-brain problem: two independent stores with no transactional consistency. Room provides the transaction guarantees, type safety, and query capability that a custom WAL would need to replicate with more code and less reliability.

3. **Move everything to JS (drop native storage entirely)** — Remove the native SharedPreferences store and let the BroadcastReceiver pass SMS data through an event bridge. Rejected because the BroadcastReceiver runs outside the React Native lifecycle. If the app is not running, there is no JS context to receive events. The native store is the only reliable persistence for the background receiver path.

4. **Keep SharedPreferences and add a mutex only** — Avoid Room by just wrapping existing SharedPreferences access with mutexes. Rejected because SharedPreferences is not designed for structured queries (filter by status, count pending items) and provides no transactional integrity for multi-field writes. Room is the standard Android solution for this use case and aligns with long-term maintainability.

## Privacy and policy notes

This ADR does not change the privacy boundary defined in ADR-003. Raw SMS content remains on-device. Queue data moves from AsyncStorage + SharedPreferences to Room, both of which are local-only Android storage. No new data leaves the device.

## Rollout and follow-up scope

- Implement Phase 1 first (fingerprint unification, mutexes, map storage, write serialization). ✓ Complete.
- Ship Phase 2 (Room, repository, migration) as a single coherent change. ✓ Complete.
- Remove old SharedPreferences-based code and AsyncStorage queue key after the migration has run successfully in production. ✓ Complete.
- Phase 3 (JS cleanup + native parser extraction) done. JS `parser.ts`, `fingerprint.ts`, and their tests deleted. All regex/fingerprint logic unified in `SmsMessageParser` in `expense-buddy-sms-import`. ✓ Complete.
- Phase 4 (reliability logging + import source metadata) done. ✓ Complete.
- Monitor `sms_import_journal` for unexpected dedupe patterns after rollout.
- Monitor crash rate and ANR frequency after the Room migration.

**Phase 5 — Zero-Hop Architecture (Current State)**

13. **Complete centralization of SMS reading**: Moved `SmsInboxScanner.kt` and all Telephony querying natively into `expense-buddy-background-sms`.
14. **Direct native sync**: Implemented `syncInboxAsync` directly on `ExpenseBuddyBackgroundSmsModule` that completely bypasses JS orchestration, parsing, and deduplication for manual scans. JS just calls `syncInboxAsync` and native reads, parses, dedupes, and queues items in one hop.
15. **Consolidate permissions**: Moved all Android `Manifest.permission.READ_SMS` permission checks and methods from `sms-import` to `background-sms`.
16. **Pure utility module**: `expense-buddy-sms-import` is now entirely decoupled from Android Telephony. It serves purely as a pure Kotlin/ML logic library containing `SmsMessageParser` and `SmsCategoryLiteRtClassifier`.
17. **Dead code removal**: Deleted the JS state machine orchestrator `bootstrap.ts` completely. JS now just acts as a pure read-projection of the native queue.
