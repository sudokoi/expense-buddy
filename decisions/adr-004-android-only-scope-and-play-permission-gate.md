# ADR-004: Android-Only Scope and Play Permission Gate for SMS Import

**Date:** 2026-04-11  
**Status:** Proposed  
**Author:** Planning draft via GitHub Copilot

---

## Context

Expense Buddy currently contains iOS and web support remnants, but the SMS import feature only makes product sense on Android. Android also imposes runtime permission requirements and Google Play treats SMS access as a restricted permission area.

The first release of SMS import should stay narrow so the team can validate permission acceptance, parse quality, review burden, and battery impact before expanding scope.

## Decision

Scope SMS import v1 to Android only and treat Google Play permission approval as a release gate.

For v1:

- support Android only
- soft de-scope iOS and web in docs and product positioning immediately
- keep hard platform-code cleanup as a later follow-up
- limit the initial historical bootstrap scan to the last 7 days only
- use app-open bootstrap plus incremental rescans rather than a continuous background service
- require policy validation and release-review preparation before production rollout

## Consequences

### Positive

- Keeps the first version aligned with the only supported platform for SMS ingestion
- Reduces implementation surface and testing burden
- Limits first-run noise by capping historical scan depth to 7 days
- Avoids committing to battery-heavy or policy-risky background behavior too early

### Negative

- Users will not get deeper historical imports in the first release
- The codebase will temporarily retain some iOS/web branches until cleanup is scheduled
- Production rollout may be delayed by Google Play permission review timelines

## Rejected alternatives

1. Full inbox historical import in v1.
   - Rejected because it increases privacy exposure, review burden, and startup cost.
2. Keep cross-platform claims while shipping Android-only SMS import.
   - Rejected because it creates product ambiguity and weakens documentation accuracy.
3. Add always-on SMS listening in v1.
   - Rejected because the first release should minimize resource usage and policy complexity.

## Privacy and policy notes

This ADR depends on explicit Google Play restricted-permission review and corresponding updates to README and PRIVACY documentation. If Play compliance cannot be established for production, the implementation may still be useful for internal or sideloaded builds, but the store rollout must remain blocked.

## Rollout and follow-up scope

- First release: 7-day bootstrap scan, app-open review queue, manual rescan, Android-only documentation.
- Later release: consider extending the scan window beyond 7 days.
- Later release: consider new-SMS event capture behind a feature flag and a separate decision review.
- Later cleanup: remove remaining iOS/web code paths and dependencies after the Android SMS path stabilizes.
