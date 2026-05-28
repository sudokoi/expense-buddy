---
"expense-buddy": patch
---

Migrate SMS import pipeline to native-owned with unified SMS parsing, ML-based categorization, on-device structured logging, and a Room-backed review queue with event-driven sync. This eliminates duplicate JS/native regex logic, removes a separate ML bridge round-trip, and adds first-class debugging support via device logs attached to bug reports.
