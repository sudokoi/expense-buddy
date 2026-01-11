---
"expense-buddy": minor
---

Add payment instrument management, analytics integration, and GitHub sync support.

- Adds saved payment instruments (Credit/Debit cards + UPI) with nicknames and digit-masking support, including validation/utilities and startup migration that backfills instruments + links existing expenses while keeping expense CSV backward compatible.
- Updates expense entry/edit flows to select a saved instrument (or “Others” manual digits) via a new inline dropdown, plus a settings screen section to add/edit/remove instruments.
- Expands analytics to support full payment-method filter chips and dependent instrument chips, including instrument-level breakdown sections and tappable pie chart flows.
- Extends GitHub sync to optionally sync settings.json (when enabled), hydrate merged settings on sync-down, and include payment instruments in settings merges; auto-sync surfaces downloaded settings.
- Adds comprehensive non-UI test coverage for payment instrument merging, settings hydration, and migration/linking behavior; removes stray test output artifacts.
