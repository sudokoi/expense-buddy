---
"expense-buddy": major
---

Ship Android SMS import as a review-first, local-only workflow and formalize its platform-scoped behavior in the product docs.

- add Android-only SMS import with on-device regex parsing, bounded recent-message scans, and inline permission requests during manual scans
- show SMS permission status in Settings and keep raw SMS content in a local review queue until the user accepts an expense
- map SMS category suggestions onto the shipped default categories and fall back to Other when no default category matches or the suggested category no longer exists
- update privacy, architecture, README, and ADR documentation to reflect the release behavior and data boundaries