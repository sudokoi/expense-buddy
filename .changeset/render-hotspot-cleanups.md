---
"expense-buddy": patch
---

Small render-performance cleanups:
- Move `SyncIndicator`'s `StyleSheet.create` out of the render body to module scope, applying only the dynamic values (position, colors) inline. Previously the style object was recreated on every sync render.
- Gate the tab-change navigation log behind `__DEV__` so it no longer performs I/O on every tab switch in production builds.
- Hoist the empty `instruments` array in the dashboard's `RecentExpenseItem` to a stable module-level constant, avoiding a fresh `[]` identity per dashboard render.
