# ADR-010: Region Packs for SMS Import and CA/AU Locale Support

**Date:** 2026-08-23
**Status:** Proposed
**Related:** ADR-003 (Regex-First SMS Import), ADR-004 (Review-First Local-Only SMS Staging), ADR-007 (Native-Owned SMS Review Queue)

---

## Context

Expense Buddy currently supports five locales (`en-US`, `en-GB`, `en-IN`, `hi`, `ja`) and five currencies (`INR`, `USD`, `GBP`, `EUR`, `JPY`). SMS import is India-only by construction: `SmsMessageParser.kt` hardcodes INR amounts, UPI-specific patterns, and `matchedLocale = "en-IN"`. ADR-003 anticipated this growing into "locale or region-specific regex packs."

We want to support Canada and Australia:

1. **Locales:** `en-CA` and `en-AU` need not ship new translation bundles — they are spelling-compatible with `en-GB` ("Colour"). Copying bundles would duplicate ~60KB each and drift over time.
2. **Currencies:** CAD and AUD must join `SUPPORTED_CURRENCIES`. Expense records already store free-form ISO currency strings end-to-end (CSV, sync, merge), so persistence needs no change.
3. **SMS region:** Canadian (Interac, TD/RBC/Scotia alerts) and Australian (CBA/NAB/Westpac, PayID/Osko) bank SMS match none of the current India-first patterns.

Two constraints shape the decision:

- **Non-breaking:** existing users' behavior must be byte-identical after upgrade. Fingerprints are content-derived (`sha256(sender|amount|timeWindow|body)`), so any parser regression silently breaks dedupe.
- **No real SMS corpora exist** for CA/AU yet. Patterns will initially be reconstructed from publicly documented bank alert templates, so v1 packs must be conservative (high precision, lower recall).

Region auto-detection via SIM country was considered and rejected: dual-SIM devices (common in the core Indian audience) make it ambiguous, it is the only hidden runtime input in an otherwise fully explicit pipeline, and it cannot be tested deterministically.

## Decision

### 1. Region is a first-class user setting, derived from language by default

A new optional `smsRegion` field joins `AppSettings` (`"IN"` | `"CA"` | `"AU"`), surfaced as a **Region** control in the Localization settings group, below Language and Currency.

- **Cascade:** changing language auto-updates region via `LANGUAGE_REGION_MAP` (`en-IN`/`hi` → `IN`, `en-CA` → `CA`, `en-AU` → `AU`, all others → `IN`; a stored `language` of `"system"` resolves through the device locale tag before mapping), exactly mirroring the existing language→currency cascade in `setLanguage` (`stores/settings-store.ts`). **The cascade stomps unconditionally:** any manually-set currency *and* region are reset on every language change — no provenance tracking. This makes an explicit confirmation prompt mandatory: it must state that language, currency, and region will all change, and offer cancel. Asymmetry is preserved: manually changing region or currency does not touch language.
- **Seeding:** during hydration/migration, an absent `smsRegion` is seeded **once** from the device locale (`getLocales()[0].languageTag` mapped through `LANGUAGE_REGION_MAP`, fallback `IN`) — the same mechanism that seeds `defaultCurrency` from `getSystemCurrency()`. After first materialization it is user-owned. A fresh Canadian install therefore gets `en-CA` UI and `CA` region out of the box.
- **Override:** the user may change region independently afterwards; the cascade only fires on language change (and stomps, per above).
- **Fallback:** any unmapped or unknown value resolves to `"IN"`. This preserves current behavior for every existing user, including those on `en-US`/`en-GB`/`ja` who today receive India-pack parsing regardless of language.
- **Platform:** SMS import is Android-only (ADR-005). The Region control renders only on Android; on iOS the field stays in schema/sync so cross-device settings remain consistent, and the language→region cascade still runs harmlessly. Any stale non-Android references encountered in touched code paths are removed in the same change (cleanup everywhere, always).

### 2. Locales are aliases, not copies

`en-CA` and `en-AU` join `SUPPORTED_LOCALES` but load the existing `en-GB` translation module. i18next registers identical resources under each key; date-fns mappings use `enCA`/`enAU`; Intl formatting uses the full locale tag. If genuine divergences emerge later, promotion to standalone bundle directories is additive.

### 3. Parser becomes region packs; region flows JS → native per call

`SmsMessageParser.kt` refactors into a `SmsRulePack` interface (amount pattern, debit/credit keywords, OTP/negative filters, merchant patterns, payment-method hints, category rules, plus `localeTag`, `currencyCode`, pattern-key prefix). The shared pipeline (normalize → skips → amount → merchant → category → payment method → fingerprint) is unchanged.

**Region plumbing (foreground vs background):**

- *Foreground (manual inbox scan):* region is passed as a live call parameter on every parse invocation (`syncInboxAsync(region, useMlOnly)`).
- *Background (headless receiver):* region cannot be passed per-call because parsing does not flow through JS. Instead, JS **pushes** the region to native-persisted state on every change — mirroring the existing `setBackgroundSmsEnabledAsync` mechanism (`stores/settings-store.ts`, `initializeSettingsStore`). The native module holds pushed configuration only; it never queries AsyncStorage or device state at parse time. Unrecognized values resolve to the India pack natively, independent of JS correctness.

### 4. Non-breaking invariants

1. Settings schema change is additive-only, delivered as a versioned migration: `migrateV9ToV10` stamps `smsRegion` (one-time device-locale seed, fallback `IN`; present-but-invalid values re-seed), `hydrateSettingsFromJson` gains the `< v10` branch and per-key default so older remote `settings.json` downloads hydrate correctly, the `loadSettings` async chain gains the matching step, and `DEFAULT_SETTINGS.version` bumps to 10. `settings.patch` ops carry partial updates; older app versions ignore the unknown key.
2. The pack refactor lands within the single delivery PR but as its own commit, proven by golden tests asserting identical `amount`, `fingerprint`, `matchedPatternKey`, `currency`, and `skipReason` outputs against existing fixtures — parity verifies per-commit and regressions bisect cleanly despite cleanup being permitted everywhere.
3. Absence of the region argument means today's behavior (India pack); natively, unrecognized pushed values also resolve to India.
4. CSV columns, sync payloads, expense schema, fingerprint format, and the Room review-queue entity are untouched. Currency remains an opaque ISO string end-to-end.
5. **The legacy currency fallback stays `INR` globally.** It exists for pre-currency-column expense rows, all of which are INR-era data; making it locale- or region-aware would silently re-bucket existing history on export/import/analytics for new-region users. New-region expenses always carry explicit currency and never reach the fallback.
6. CA/AU packs activate only when explicitly selected (directly or via the language cascade); no code path routes existing India users' messages through new logic.

### 5. Delivery

All changes ship in a single PR, ordered internally as atomic commits so each is independently revertible and bisectable:

1. Stale-reference cleanup commit.
2. Parser pack refactor commit (India verbatim, golden parity tests).
3. Locales + currencies commit (`en-CA`/`en-AU` aliases, CAD/AUD).
4. Settings migration + Region control + language-change confirmation prompt commit.
5. Conservative CA/AU packs + reconstructed fixtures commit.

## Consequences

### Positive

- No duplicated translation bundles; single source for shared en-GB strings.
- Region selection is explicit, deterministic, testable, and synced like every other setting.
- Dual-SIM ambiguity and `$`-currency ambiguity disappear (the user declares their region).
- Review-first staging (ADR-004/007) absorbs conservative-pack imprecision: false parses cost a rejected queue item, not ledger corruption.
- `matchedPatternKey` per pack enables future local diagnostics of coverage gaps without telemetry.

### Negative

- Wrong region fails silently (empty review queue); mitigated by help text on the Region control and the language-change confirmation prompt.
- One control (language) now drives translations, formatting, currency, *and* region — consistent with the existing currency cascade but a wider blast radius per tap.
- CA/AU regexes start as hypotheses from documented templates; recall will require iterative tuning against real samples.
- Historical review-queue items keep their stored locale when region changes; mixed-region histories are possible for users who relocate (accepted; raw SMS remains inspectable per ADR-004).

## Rejected alternatives

1. **SIM/network country auto-detection.**
   - Rejected: ambiguous on dual-SIM devices, hidden runtime input, untestable determinism, and wrong during travel.
2. **Deriving region purely from language with no override control.**
   - Rejected as terminal state (silent failures with no recourse) but adopted as the default-value mechanism; the explicit control is the escape hatch.
3. **Cascades that respect manual overrides (per-field `manuallySet` provenance flags).**
   - Rejected: persistent hidden state, expanded sync surface, and surprising partial cascades; the loud confirmation prompt with cancel achieves the same user protection with zero new state.
4. **Copying en-GB bundles into en-CA/en-AU directories.**
   - Rejected: ~120KB duplication and guaranteed drift for zero present divergence.
5. **Currency-derived region (`INR`→IN etc.).**
   - Rejected: tighter bank correlation but breaks for multi-currency users, and flipping display currency would flip parsing semantics.
6. **Shipping CA/AU packs behind SIM gating instead of the setting.**
   - Rejected: reintroduces detection; inconsistent with decision 1.
7. **Locale- or region-aware legacy currency fallback.**
   - Rejected: pre-currency-column expense rows are all INR-era data; a mutable fallback would silently re-bucket existing history for new-region users on CSV export/import and analytics grouping.
