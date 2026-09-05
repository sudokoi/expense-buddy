---
"expense-buddy": patch
---

Reduce redundant Android widget work

- Merge overlapping widget refreshes and retain a fresh trailing refresh when data changes during rendering.
- Calculate summary, trend, and recent data only when the corresponding widget needs it.
