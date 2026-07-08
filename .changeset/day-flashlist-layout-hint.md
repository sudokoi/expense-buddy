---
"expense-buddy": patch
---

Add `getItemType` and `overrideItemLayout` to the Day view's `FlashList` so
row heights are known up front instead of measured per row. Matches the
History screen's `FlashList` configuration and avoids layout measurement work
when a day has many expenses.
