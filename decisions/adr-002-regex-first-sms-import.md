# ADR-002: Regex-First SMS Import

**Date:** 2026-04-11  
**Status:** Proposed  
**Author:** Planning draft via GitHub Copilot

---

## Context

Expense Buddy is planning Android-only SMS-based expense import. PR 43 explored this space but converged on an on-device TFLite parser and removed regex-based parser files. That branch preserved strong product boundaries such as review-first import and local-only raw SMS handling, but it moved the parsing strategy toward a model-dependent path that is heavier to maintain, harder to explain, and riskier to ship in an Expo/Metro app.

The current product goal is a narrow first release that prioritizes reliability, explainability, and low operational complexity, especially for India-focused transaction SMS patterns.

## Decision

Adopt a regex-first parser for v1 SMS import.

The parser will:

- use deterministic pattern matching rather than ML or TFLite
- prioritize India-first transactional SMS coverage
- be implemented as a registry of locale or region-specific regex packs
- keep extraction logic explainable and testable
- defer any ML or hybrid parser approach to a later ADR if regex-first proves insufficient

## Consequences

### Positive

- Easier to debug and validate against real SMS fixtures
- Lower implementation and maintenance complexity
- No bundled ML model assets, tokenizer files, or model-loading constraints in v1
- Better fit for a review-first UX where the system should be transparent about why a message matched

### Negative

- Lower ceiling for recall compared with a mature ML system
- More manual pattern maintenance as banks and providers change message templates
- Requires region-specific matcher growth over time

## Rejected alternatives

1. Revive the PR 43 TFLite parser path.
   - Rejected for v1 because it increases runtime and packaging complexity and moves the product away from an explainable parser.
2. Hybrid regex + ML in v1.
   - Rejected because mixing strategies too early increases debugging complexity and weakens the narrow MVP.
3. Server-side parsing.
   - Rejected because the product requirement is on-device parsing with no backend and strong privacy boundaries.

## Privacy and policy notes

This decision supports local-only processing and avoids introducing any remote inference path. It does not remove the need for Google Play restricted-permission review for SMS access.

## Rollout and follow-up scope

- Start with India-first regex packs for debit card, credit card, ATM withdrawal, bank debit, and UPI transactional messages.
- Add smoke coverage for the other currently supported locales after the India-first path is stable.
- Revisit ML only if regex-first coverage, precision, or maintenance cost proves insufficient after release data is reviewed.
