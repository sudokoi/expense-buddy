# ADR-012: Android Home-Screen Widgets — Native-Read-First

**Date:** 2026-09-04
**Status:** Accepted
**Related:** ARCHITECTURE.md (local-first, explicit state boundaries), ADR-007 (native-owned SMS queue), `services/expense-storage.ts`, `services/settings-manager.ts`, `services/storage.ts`, Ritulaya `ritulaya-widget` (reference only)

---

## Context

Users want glanceable spend data without opening the app: today/month totals, a last-7-day trend, and recent expenses. Android widgets (`RemoteViews`) cannot run React, `gifted-charts`, or NativeWind — only `TextView`/`ImageView`/`LinearLayout`/`ListView`.

Expense Buddy's expenses live in MMKV (`id "expense-buddy"`): `expenses:index:v1` + `expenses:item:v1:<id>` JSON, settings in `app_settings` JSON. There is no Room table for expenses (unlike the SMS review queue or Ritulaya's cycles). A widget that depends on JS pushes alone goes stale when the app is killed, after background sync merges, or across reboots — the exact failure Ritulaya avoids by letting its provider read live Room rows and re-derive counters at render time.

Widget shapes under consideration: Summary (2x1/2x2), Trend 7d (4x2), Recent list (4x3, resizable). Per-instance filters must stay small enough for a home-screen surface.

## Decision

### 1. Native-read-first, assist-hints-only (Ritulaya shape, MMKV source)

- The widget's source of truth is the same MMKV files the app reads. A new Kotlin `ExpenseWidgetStore` reads index + items natively on every `onUpdate` and derives all numbers at render time (today/month/7d/recent), applying the same semantics as JS: drop `deletedAt`, `Math.abs(amount)`, `currency ?: defaultCurrency ?: INR`, device-local day keys (`ZoneId.systemDefault`, `yyyy-MM-dd`).
- JS is a fast path only: a tiny `WidgetAssist` snapshot (`currency, categoryColors, labels, dataVersion=max(updatedAt)`) written best-effort on mutations, plus a `refreshWidgets()` broadcast. Correctness never depends on it.
- Staleness rule (mirrors Ritulaya's `dataVersion` check): if assist `dataVersion` is older than live `max(updatedAt)`, ignore assist numbers and recompute from live rows; assist strings may still be used with English fallback.

### 2. Three providers, one data Module

- One deep Module `ExpenseWidgetStore` with interface `fun read(now, filter): WidgetResult` (`Ready | Empty | Unavailable`). Hides MMKV keys, JSON parsing, timezone, currency fallback, aggregation.
- One narrow `WidgetAssist` reader (`fun load(): Assist?`).
- Three thin provider Adapters at the `RemoteViews` seam: `Summary`, `Trend7d` (7 weighted `View` bars, zero-filled), `Recent` (`RemoteViewsService` list, capped at 8).
- One bridge Module `ExpenseBuddyWidgetModule` with a single `refreshWidgets()` broadcast. No data params.

### 3. v1 scope limits

- Per-instance filter is `category + hideAmounts` only (stored in `expense_widget_<id>` prefs). Full `FilterState` parity (time/method/instrument/search) stays in-app.
- No widget-side editing or quick-add-without-app. Taps deep-link (`myapp://add`, review route); `+` opens the app.
- Theming uses Material You system colors, not `constants/palette.ts`. `hideAmounts` covers lock-screen privacy.
- Freshness without JS: `ACTION_DATE_CHANGED` receiver (midnight rollover) + `BOOT_COMPLETED` + 30-min `WorkManager` backstop. `updatePeriodMillis=0`.

## Consequences

### Positive

- Widgets stay correct with the app killed, after sync-while-closed, and across reboots — same guarantee Ritulaya gets from Room, without migrating expenses to Room.
- One aggregation owner in Kotlin; providers stay thin; JS/TS analytics untouched.
- Small bridge surface: one broadcast function, one assist writer.

### Negative

- MMKV must be added as a native dependency of the new module (`com.tencent:mmkv`), including multi-process mode; JS and widget race on the same file (tolerated: reads are best-effort, JS heals corrupt index on next launch).
- Aggregation logic exists twice (TS + Kotlin) with a parity contract to maintain (day keys, abs amounts, currency fallback, zero-fill). Mitigated by focused unit tests on both sides asserting the same invariants.
- `RemoteViews` limits: no real charts, no custom fonts — bars are weighted views, lists are plain rows.

## Rejected alternatives

1. **JS-push-only snapshot in `SharedPreferences`.** Rejected: stale whenever the process is dead; makes the widget a second source of truth.
2. **Migrate expenses to Room for widgets.** Rejected: massive migration for a read-only surface; MMKV is already natively readable.
3. **Full filter parity per widget instance.** Rejected for v1: overwhelming on a 4x1 surface and duplicates `FilterState` complexity in Kotlin.
