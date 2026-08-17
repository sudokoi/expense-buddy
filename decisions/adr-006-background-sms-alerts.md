# ADR-006: Android Background SMS Alerts Stay Local and Review-First

**Date:** 2026-05-22  
**Status:** Accepted  
**Author:** Implementation follow-up via GitHub Copilot

---

## Context

Expense Buddy already supports Android SMS import through a manual bounded scan and a local review queue. That flow keeps raw SMS content on-device and avoids silently creating expenses, but it still requires the user to proactively rescan or reopen the app to notice new transactions.

The product now needs a lightweight way to surface newly received transaction SMS messages without introducing a polling service, a remote backend, or an auto-import path that bypasses review.

## Decision

Add Android-only background SMS transaction alerts using a broadcast-receiver-driven Expo native module.

The system will:

- listen only for Android `SMS_RECEIVED` broadcasts when the feature is enabled
- parse incoming messages locally with the same review-first boundaries as the existing SMS import flow
- persist a local native snapshot of pending review items so notification routing can stay offline
- show a local notification only when the app is not foregrounded
- route notification taps into the existing `/sms/review` flow
- open the targeted item directly when exactly one pending match exists
- open the review queue when multiple pending matches exist
- keep raw SMS content, notification state, and review metadata local to the device

## Consequences

### Positive

- Users can notice new transaction candidates without rescanning manually
- The implementation stays offline and avoids a backend or push-notification dependency
- Battery impact stays low because the app does not poll, schedule recurring work, or run a foreground service
- The review-first boundary remains intact because notifications reopen the existing staging flow instead of creating expenses automatically

### Negative

- Android permission surface expands to include `RECEIVE_SMS` and `POST_NOTIFICATIONS`
- Notification tap routing requires the JS review queue and native snapshot to stay in sync
- Real-time behavior now depends on Android broadcast delivery rules and OEM notification behavior

## Rejected alternatives

1. Poll for new SMS messages with WorkManager or JobScheduler.
   - Rejected because it adds battery cost and scheduling complexity for a problem Android already exposes through `SMS_RECEIVED`.
2. Auto-create expenses when a background SMS looks high confidence.
   - Rejected because it breaks the review-first boundary for financial records.
3. Send matched SMS content to a backend or remote notification service.
   - Rejected because it widens the privacy surface and is unnecessary for the local-only product model.

## Privacy and policy notes

This ADR extends the existing SMS import model without changing its core privacy boundary. Raw SMS content still remains on-device, only local notifications are used, and only user-confirmed expenses enter the normal expense store or optional GitHub sync.

Because SMS access remains a restricted-permission area on Google Play, release documentation and policy review must cover the added background-alert behavior and the new permissions.

## Rollout and follow-up scope

- Ship Android-only background alerts behind an explicit Settings toggle.
- Keep the receiver path lightweight with no polling, boot receiver, or foreground service.
- Monitor parse quality and notification usefulness before considering grouped notifications or richer actions.
