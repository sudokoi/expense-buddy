# ADR-003: Review-First Local-Only SMS Staging

**Date:** 2026-04-11  
**Status:** Proposed  
**Author:** Planning draft via GitHub Copilot

---

## Context

Expense Buddy currently stores expense data locally and optionally syncs confirmed expense records to the user's own GitHub repository. SMS import introduces more sensitive source material than manual entry because raw SMS messages may contain sender identifiers, transaction references, and bank-provided metadata.

PR 43 established an important boundary: raw SMS content should remain local and the import UX should be review-first rather than silently creating expenses.

## Decision

Adopt a review-first import flow with local-only staging for SMS-derived data.

The system will:

- stage parsed candidates in a dedicated local review queue
- require explicit user confirmation before creating expense records
- keep raw SMS bodies, senders, and dedupe fingerprints out of synced expense records
- keep review-state storage local to the device
- avoid syncing raw SMS data or review metadata to GitHub in v1

## Consequences

### Positive

- Strong privacy boundary between source SMS data and synced expense data
- Lower risk of incorrect expenses being silently created
- Better fit for imperfect parsing and low-confidence category inference
- Easier to explain to users and document in the privacy policy

### Negative

- Adds a review step before import is complete
- Requires a dedicated review queue store and launch-time UI handling
- Some users may perceive the flow as slower than silent automation

## Rejected alternatives

1. Silent auto-create of expenses from matched SMS.
   - Rejected because regex parsing will be imperfect and the app should not create financial records without user review.
2. Sync raw SMS metadata to GitHub alongside expenses.
   - Rejected because it broadens the privacy surface and is not necessary for v1.
3. Store SMS-derived metadata directly on the shared Expense schema.
   - Rejected for v1 because it complicates CSV and sync compatibility. A separate local metadata store is preferred.

## Privacy and policy notes

This ADR is central to the product's privacy posture. The privacy policy and architecture document must explicitly state that raw SMS content remains on-device and that only user-confirmed expenses enter normal expense storage and optional GitHub sync.

## Rollout and follow-up scope

- Implement a local review queue with pending, accepted, rejected, and dismissed states.
- Add a secondary UI entry point so users can revisit dismissed items later.
- Revisit optional synced learnings or merchant rules only under a separate ADR and only without syncing raw SMS content.
