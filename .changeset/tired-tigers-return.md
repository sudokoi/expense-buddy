---
"expense-buddy": patch
---

Migrate SMS review queue from JS-owned (AsyncStorage + SharedPreferences) to native-owned Room database with event-driven sync

- Strip JS queue ownership: remove AsyncStorage persistence/merge, replace enqueue.effect calls with native TurboModule APIs
- Implement Room-backed SmsReviewQueueRepository with Mutex-guarded operations in expense-buddy-background-sms
- Add reactive Flow observer that emits `onReviewQueueUpdated` on any Room change
- Wire event-driven sync in store-provider: subscribe to onReviewQueueUpdated, refetch full snapshot
- Switch BroadcastReceiver from SharedPreferences to Room using goAsync() + coroutine
- Remove dead code: BackgroundSmsReviewQueueStore, BackgroundSmsReviewQueueSnapshot, old data classes and APIs
- Enable Room schema export; add standalone ktlint CLI runner
