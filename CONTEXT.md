# Domain Glossary — Expense Buddy

Single source for product terms that have one meaning in this repo. Prefer these terms in code, ADRs, and reviews.

| Term | Meaning | Where it lives |
|---|---|---|
| **Expense** | A confirmed financial record with `amount`, `currency`, `category`, `date`, `paymentMethod`. Survives restarts and syncs via daily CSV. | `types/expense.ts`, `stores/expense-store.ts` |
| **PaymentInstrument** | Saved card/UPI instance (`method`, `nickname`, `lastDigits`, `instrumentId`) linked to an Expense via `paymentMethod.instrumentId`. Synced if `syncSettings` enabled. | `types/payment-instrument.ts`, `services/payment-instruments.ts` |
| **Fingerprint** | Deterministic SHA-256 dedupe key for SMS: `sha256(sender|amount|timeWindow|body)` where `timeWindow` is 3-min quantization. Same SMS via any path yields same `sms_<hex>`. | `modules/expense-buddy-sms-parser/.../SmsMessageParser.kt:271` `createFingerprint`, `types/sms-import.ts` |
| **Review Queue** | Native-owned pending SMS → expense candidates. Persisted in Room `sms_review_queue` (status `PENDING`/`APPROVED`/`REJECTED`/`DISMISSED`), surfaced via `SmsImportReviewProvider` (not XState). Raw SMS stays local. | `modules/expense-buddy-sms-module`, `providers/sms-import-review-provider.tsx` |
| **Category** | User-visible expense bucket (default 8 + custom). `label` is canonical, `Other` always last, `order` is display order. Sync merges by `label`. | `types/category.ts`, `stores/settings-store.ts` |
| **EffectiveTheme** | Resolved `light|dark` from `settings.theme` (`light|dark|system`) + `systemColorScheme` (Appearance). Single selector `selectEffectiveTheme`. | `stores/settings-store.ts:627` |
| **Theme tokens** | Single source `constants/palette.ts` → `global.css` vars → `tailwind.config.js` mapping. `palette.light/dark` are ground truth. | `constants/palette.ts`, `global.css`, `tailwind.config.js`, `scripts/check-theme-sync.js` |
| **Sync (fetch-merge-push)** | Git Trees + SHA cache → download changed daily CSV only → merge by `id`/`deletedAt` → push dirty-day CSV. Credentials stay in SecureStore, `settings.json` optional. | `services/sync-manager.ts`, `services/github/api.ts`, `stores/helpers.ts` |
| **Dirty Day** | Date string `YYYY-MM-DD` marking a day whose local file changed since last sync. Limits hashing/uploads. | `services/dirty-days.ts` |
| **AppSplashGate** | Keeps native splash until fonts + `isLoading` + `NativeWind colorScheme === effectiveTheme` — eliminates system-theme flash. | `app/_layout.tsx:65` |

## Boundaries (from ARCHITECTURE.md)
Routes → hooks → stores → services → native modules. `stores/` must not import `providers/`; native modules accessed via `services/` wrappers. See `decisions/adr-007`, `adr-009`.

## Non-goals
Generic programming terms (`timeout`, `retry`) are not glossary entries.
