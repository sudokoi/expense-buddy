---
"expense-buddy": patch
---

Fix the analytics stats cards hiding the "of ₹X" subtext when only a time filter (e.g. "Last 1 month") was active. The subtext is now shown whenever any filter is active and the headline is scoped below the full-period total — the full-period total is the all-time grand total for the currency, ignoring every filter including the time window. The subtext only disappears in the default/reset state (no active filters).
