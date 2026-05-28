---
"expense-buddy": patch
---

Migrate SMS import pipeline to native-owned with unified SMS parsing, ML-based categorization, on-device structured logging, and a Room-backed review queue with event-driven sync. This eliminates duplicate JS/native regex logic, removes a separate ML bridge round-trip, and adds first-class debugging support via device logs attached to bug reports.

Fixes and improvements:

- Fix batchCommit retry to actually retry CONFLICT/RATE_LIMIT errors
- Wire batch dismiss API for SMS review queue
- Fix repo browser FlatList scrolling + gap between search and items
- Put date selector inline with label to reduce vertical space
- Unify filter button styles across history and analytics screens
- Fix "+Add" button styling in payment instruments section
- Fix GitHub "Test" button text readability when not connected
- Use GitHub REST API for bug report creation instead of URL params (avoids 8k limit)
- Fix report bug dialog: use i18next defaultValue instead of broken ?? fallback
- Translate all untranslated English strings in hi and ja locale files (470 keys)
- Remove unused imports, dead barrel file, stale variables
