---
"expense-buddy": patch
---

Complete zero-hop SMS architecture: delete remaining JS bridge files, add SkipReason diagnostics, move provider to proper location, and remove dead code.

- **SmsMessageParser diagnostics**: Add `SkipReason` enum, `parseRawMessageWithReason`, and combining-marks stripping for Mathematical Sans-Serif Unicode handling
- **Delete `expense-buddy-sms-import` Expo module**: Removed `ExpenseBuddySmsImportModule.kt`, all TypeScript bridge files, `expo-module.config.json`, and `expo-module-gradle-plugin` — sms-import is now a pure Kotlin library (renamed to `expense-buddy-sms-parser`) with no JS bridge
- **Move provider**: Relocated `SmsImportReviewProvider` from `stores/hooks/` to `providers/sms-import-review-provider.tsx`, following the project's Context provider pattern
- **Concurrent sync guard**: Added `AtomicBoolean` mutex to `syncInboxAsync` to prevent duplicate work from rapid taps
- **Permission safety**: `syncInboxAsync` now throws `SmsPermissionMissingException` if `READ_SMS` is not granted
- **Dead code removal**: Removed `insertPendingItemsAsync` (all layers), `reviewItemToDto`, `getLastScanCursorAsync`/`setLastScanCursorAsync` (Kotlin), `patchConsole`, `optNullableString`/`optNullableDouble` — 382 lines removed
- **Memoize suggestion resolution**: Pre-compute category/payment method suggestions in `SmsImportReviewScreen` to reduce per-item re-computation during renders
- **Update docs**: ARCHITECTURE.md, README.md, ADR-006 updated to reflect zero-hop architecture and React Context provider pattern
