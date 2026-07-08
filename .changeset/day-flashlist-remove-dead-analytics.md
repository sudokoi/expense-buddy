---
"expense-buddy": patch
---

Replace the single-section `SectionList` in the Day view with `FlashList`, and delete the unused `useAnalyticsData` composite hook. The Day view renders one flat list, so `FlashList` is lighter than `SectionList`, and `analytics.tsx` now imports the individual analytics hooks directly instead of through the dead composite's re-exports.
