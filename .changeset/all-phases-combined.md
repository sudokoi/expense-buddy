---
"expense-buddy": minor
---

- **Zero-hop SMS architecture**: Delete JS bridge files for sms-import, move `SmsImportReviewProvider` to `providers/`, add `SkipReason` diagnostics and combining-marks stripping for mathematical sans-serif Unicode
- **Concurrent sync guard**: `AtomicBoolean` mutex on `syncInboxAsync` to prevent duplicate work from rapid taps
- **ML classifier resilience**: `syncInboxAsync` gracefully falls back to regex-only if `SmsCategoryLiteRtClassifier` fails to load, preventing model issues from blocking all SMS detection
- **Module renames**: `expense-buddy-background-sms` → `expense-buddy-sms-module`, `expense-buddy-sms-import` → `expense-buddy-sms-parser`; Kotlin packages, classes, and TS types renamed accordingly
- **Dead code removal**: 382 lines — `insertPendingItemsAsync`, `reviewItemToDto`, `getLastScanCursorAsync`/`setLastScanCursorAsync`, `patchConsole`, `optNullableString`/`optNullableDouble`
- **Memoize suggestion resolution**: Pre-compute category/payment method suggestions in `SmsImportReviewScreen`
- **Bug fixes**: batchCommit retry CONFLICT/RATE_LIMIT errors, report bug dialog i18n, FlatList scrolling on repo browser, filter button style unification, button styling fixes
- **Translations**: 470 keys across 5 locales, all untranslated hi and ja strings translated
- **Tests**: 730 tests across 79 suites; enhanced mathematical sans-serif SMS detection tests with exact user-reported message
