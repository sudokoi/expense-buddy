---
"expense-buddy": minor
---

Remove the Dashboard tab and make Analytics the default (first) tab, consolidating the old dashboard's overview into the analytics page.

- The Dashboard tab is gone; analytics is now the first tab. Its header keeps the sync and SMS-import action buttons.
- The day detail screen (`/day/[date]`) is removed along with its route.
- The stats cards (Total Spent, Daily Avg, Top Category, Peak Day) now show a subtext with the full-period total — ignoring category/payment/instrument/search/amount filters — whenever any filter is active. The subtext is hidden when the filter is "All".
