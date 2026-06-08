---
"expense-buddy": major
---

feat: Google Drive sync, redesigned settings, swipeable expenses, and read-only window

- Add Google Drive as a new sync provider with native Google Sign-In and per-year JSON storage
- Redesign Settings with a multi-provider management section and swipeable provider cards
- Add swipeable expense rows with icon-only swipe actions
- Add 6-month read-only window for editing past expenses
- Rewrite sync engine with provider framework, per-provider watermarks, queue compaction, and first reconciliation
