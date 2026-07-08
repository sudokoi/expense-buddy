---
"expense-buddy": patch
---

Perf pass: share derived expense data via a single provider, memoize store-hook
return objects, use `FlashList` in the Day view, skip no-op store updates, and
hoist per-render allocations (styles, empty arrays, nav log) out of hot paths.
