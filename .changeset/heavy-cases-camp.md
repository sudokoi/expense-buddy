---
"expense-buddy": patch
---

Improve Android performance and build reliability

- Make SMS batches atomic and scan recent messages with cancellable, lossless page progress.
- Virtualize SMS review, streamline Analytics and widget aggregation, and bound background logging.
- Apply a reproducible Gradle memory budget, preserve safe build diagnostics, and default manual builds to build-only.
