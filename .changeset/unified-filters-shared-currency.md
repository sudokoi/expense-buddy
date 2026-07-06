---
"expense-buddy": minor
---

Unified the History and Analytics filters into one shared filter screen with app-wide currency selection

- **Single filter screen**: The History and Analytics filter sheets are replaced by one full-screen filter route (opened like the edit-expense screen), based on the History filter; the two old sheet components are removed.
- **Shared currency**: Currency selection now lives in one place and is common across the Dashboard, History, Analytics, and the filter screen — selecting a currency anywhere applies everywhere and persists, and clearing reverts to the default currency everywhere.
- **Default currency chip**: The filter screen's currency section has a dedicated "Default" option that shows the resolved currency (e.g. "Default (₹)") and clears an explicit selection back to auto.
- **Currency in History**: History now scopes its list to the selected/effective currency (with a removable currency chip), matching the Dashboard and Analytics.
- **Consistent visibility**: The currency control now appears only when more than one currency exists, across all surfaces.
- **Search and amount range in Analytics**: Search query and amount range filters now apply to Analytics too, not just History.
- **Dashboard header fix**: The sync and import buttons are aligned to the right of the "Welcome back" header again.
