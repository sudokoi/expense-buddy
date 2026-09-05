# Android performance implementation

Follow-up to the [source/log audit](performance-audit.md), authorized on 2026-09-05.
This is not a device benchmark or evidence that the GitHub OOM is resolved.

## Native SMS ownership

- `SmsReviewQueueRepository` owns every queue/journal transaction through an
  injected `SmsReviewQueueDatabase`. Tests use the same path as production; the
  former independent-DAO/mutex path and ineffective database annotations are gone.
- Bulk resolutions commit once, ignore duplicate fingerprints, and do not
  overwrite already-resolved items. Insertion and its journal roll back together.
- Schema 3 replaces redundant queue indices with `(status, timestamp)`. Migration
  tests open exported schemas 1 and 2, preserve queue/journal rows, exercise both
  historical index naming styles, and let Room validate the result. Destructive
  fallback has been removed: unsupported migrations fail rather than erase data.
- Native observation uses Room table invalidation, not full-row query results or
  distinct counts. Tests cover complete batch visibility and same-count edits.
- Expo SMS functions suspend on a module-owned IO scope cancelled by `OnDestroy`.
  The queue observer has the same owner. Single-flight scanning remains enforced.
  Receiver parsing occurs after `goAsync`, inside its existing eight-second work
  window; cancellation is propagated and the broadcast is always finished.

### Scan progress

`SmsInboxSource` owns Android inbox access; `SmsInboxScanner` owns typed parsing
and classification. ContentResolver access runs on IO with a cancellation signal;
parsing/inference runs on Default with cancellation checks between messages.
Model files, classification rules, and training/tooling are unchanged.

Each page holds at most 500 raw messages. Ordering and progress both use
`(timestamp, message ID)` ascending. A sync drains a fixed seven-day window in
pages, including pages containing no transaction matches. It writes each page to
Room before persisting progress: interrupted progress writes replay safely via
fingerprint deduplication. Progress is separate per SMS region. The old parsed-only
cursor is deliberately not trusted on upgrade, so the recent window is replayed.
Tests cover non-matches, equal timestamps, a full page plus a trailing row, and
expiration of the seven-day window.

The 500 limit bounds application page materialization, not the total queue or the
provider's internal query work. Late-imported messages with backdated timestamps
are not a new supported guarantee. Cancellation cannot interrupt a single native
inference in progress; it is observed before the next inference.

## React Native review and Analytics

- SMS review uses FlashList with memoized rows and recycling-aware expansion
  state. Only the editor uses `KeyboardAwareScrollView`; the list is not nested
  inside it. Per-row entry/exit animation work has been removed. Accept/edit/bulk
  actions, draft ownership, localized labels, and confirmations are retained.
- A lifecycle-owned snapshot refresher coalesces invalidations and performs a
  trailing read when an event arrives during an in-flight read. Disposal prevents
  late publication. Tests cover bursts, trailing reads, disposal, and errors.
- Filtering resolves rolling date bounds once. Instrument aggregation builds one
  ID map. The trend pipeline aggregates raw expenses directly into displayed
  daily/weekly/monthly buckets instead of building and reparsing a daily series.
  Tests preserve locale week starts, partial periods, zero-filled buckets, leap
  days, long ranges, and exclusion of invalid/out-of-range dates.

Expense-store ownership and the existing JS-expense/native-review two-write
acceptance contract are unchanged; this work does not make those separate stores
one atomic transaction.

## Widgets and logging

- Widget updates merge installed targets across provider broadcasts in a fixed
  25ms collection window. One process-owned consumer renders each batch serially,
  sharing a refresh-local ledger/settings snapshot across provider kinds and IDs.
  An invalidation during rendering creates a fresh trailing batch. Cancelling one
  broadcast waiter does not cancel the batch for others. Data is never cached by
  `max(updatedAt)` across updates. Tests verify reuse, deletes, settings changes,
  and date changes even when the maximum update timestamp stays the same.
- Summary, trend, and recent projections are lazy within the selected live data.
  Each scans rows only if requested, then reuses that result for the current render.
  Summary no longer computes seven-day data, and the Recent collection no longer
  computes totals or categories it does not display. Recent selection retains only
  the top eight in stable order.
  The Recent provider renders only the shell; its collection factory owns the live
  data read and empty view, eliminating the former duplicate ledger read.
- Removing a provider's last widget checks **all** provider kinds before cancelling
  the periodic worker; adding widgets still schedules the unique work. Each update
  waiter has an eight-second timeout, and each render batch has a seven-second
  coroutine timeout. Independent collection callbacks still take their own live
  snapshots. System widget lifecycle behavior remains to be validated on-device.
- Logging has one application-owned writer, a 256-entry mailbox, up-to-64-entry
  batches plus an overflow diagnostic, and atomic batch insertion/pruning. A drain
  pass is bounded so exports/clear cannot be starved indefinitely by producers.
  Initialization is idempotent. Reinitialization in tests cancels the old owner.
- Under overload, logs discard queued DEBUG/INFO before WARN/ERROR; a queue of
  only WARN/ERROR retains the latest high-severity entries. Loss is counted in a
  synthetic warning. Database failures are reported to Logcat rather than
  recursively logged; failed batches are not retried indefinitely. Tests cover
  bounded overflow, severity preference, stored caps, and clearing queued writes.
- Log exports/clear now suspend and explicitly dispatch database/formatting work
  off Expo's shared module thread.

## Standard/free-runner builds

`plugins/withAndroidBuildBudget.js` writes an idempotent policy after
`expo-build-properties`, so EAS/prebuild-generated Android projects receive it:

```properties
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8
org.gradle.workers.max=2
org.gradle.parallel=false
org.gradle.caching=true
kotlin.daemon.jvmargs=-Xmx1g -XX:MaxMetaspaceSize=512m
```

The policy has a regression test and was checked through Expo config introspection.
It is a bounded starting budget, not a measured optimum. Heap caps do not cap RSS;
no larger runner, global `JAVA_TOOL_OPTIONS`, swap workaround, or disabled
desugaring is involved.

Local CI builds use `scripts/build-android-ci.sh`. Its artifact contains runner
resources, process names/RSS sampled every five seconds, and allowlisted effective
Gradle properties. EAS's temporary workspace survives its own cleanup, but only
the allowlisted diagnostic directory is uploaded (seven-day retention). Signing
workspaces, environments, command arguments, and heap dumps are not uploaded.

Workflow changes also add Java/SDK setup and typecheck/Expo gates to CI, expand
Gradle cache inputs, pin the EAS CLI to the observed successful 23.2.0 version,
upgrade setup-java to v6, and disable redundant compression of APK/AAB artifacts.
Build version suffixes are validated instead of interpolated as shell code.

**Manual builds default to build-only:** `submit_to_play` must be explicitly true
to submit. Tag-push release behavior remains unchanged. Default manual build-only
runs do not publish GitHub releases or release comments. No workflow was dispatched and no
Play submission was performed. Repository environment approvals remain a separate
administrative safeguard, not something this source change can guarantee.

## Validation boundary

### Code and test cleanup follow-up

A targeted reference/test review found obsolete paths rather than evidence that
all generated-looking code was unnecessary:

- Removed the unused `aggregateByDay` implementation and `LineChartDataItem` type.
  Its meaningful completeness/sum properties now exercise the active
  `aggregateSpendingTrend` pipeline instead of keeping the obsolete path alive.
- Removed unused standalone payment-instrument/payment-method filters and their
  redundant empty-selection test. The active `applyAllFilters` path retains
  coverage. Instrument resolution now accepts its production map input only.
- Replaced unseeded random filter fixtures with deterministic defaults, preserved
  explicit zero amounts, and strengthened subset-only assertions to compare the
  complete expected result. Returning no matches can no longer pass those tests.
- Removed logger test polling around already-suspending reads, and made the count
  test exercise `count()` rather than the length of a fetched list.

Meaningful migration, cancellation, theme/localization, parser, and regression
tests are retained. This was a targeted review, not a claim that every file in the
repository has been exhaustively reviewed.

### Checks

Automated validation includes Jest, Kotlin/Robolectric, TypeScript, ESLint/ktlint,
theme/translation checks, formatting, actionlint, shellcheck, and Expo config
introspection. After the widget/cleanup follow-up, `yarn test` passed **96 Jest suites / 870 tests**, followed by
the Android Kotlin tests, including five new widget projection/coalescing tests.
The Jest count decreased by one because the obsolete payment-filter helper's
empty-selection test was removed; the active filter path retains that coverage.
Expo Doctor previously passed **21/21** checks and Expo dependency
validation remained clean. The original audit's lower-confidence font, subscription, startup
storage, and R8 candidates remain deferred until release-mode profiling supports
changing them.

Still required before claiming measured improvements:

1. A standard-runner **build-only** production build, then a warm repeat: inspect
   L8 completion, Metaspace warnings, sampled RSS, and actual task-cache reuse.
2. With explicit permission to use ADB, release-mode populated SMS-list/editor,
   cancellation, large-text/accessibility, and multi-widget lifecycle checks.
3. Device frame/CPU/memory measurements on the same data set and build mode as a
   baseline. Host operation counts and passing tests are not Android timings.

No ADB, user screenshot changes, ML-tooling changes, release dispatch, or expense
data mutation is part of this implementation.
