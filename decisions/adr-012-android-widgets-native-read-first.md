# ADR-012: Android Home-Screen Widgets — Native-Read-First

**Date:** 2026-09-04 (amended 2026-09-05)
**Status:** Accepted (amended)
**Related:** ARCHITECTURE.md (local-first, explicit state boundaries), ADR-007 (native-owned SMS queue), `services/expense-storage.ts`, `services/settings-manager.ts`, `services/storage.ts`, Ritulaya `ritulaya-widget` (reference only)

---

## Context

Users want glanceable spend data without opening the app: today/month totals, a last-7-day trend, and recent expenses. Android widgets (`RemoteViews`) cannot run React, `gifted-charts`, or NativeWind — only `TextView`/`ImageView`/`LinearLayout`/`ListView`.

Expense Buddy's expenses live in MMKV (`id "expense-buddy"`): `expenses:index:v1` + `expenses:item:v1:<id>` JSON, settings in `app_settings` JSON. There is no Room table for expenses (unlike the SMS review queue or Ritulaya's cycles). A widget that depends on JS pushes alone goes stale when the app is killed, after background sync merges, or across reboots — the exact failure Ritulaya avoids by letting its provider read live Room rows and re-derive counters at render time.

Widget shapes under consideration: Summary (2x1/2x2), Trend 7d (4x2), Recent list (4x3, resizable). Per-instance filters must stay small enough for a home-screen surface.

## Decision

### 1. Native-read-first, assist-hints-only (Ritulaya shape, MMKV source)

- The widget's source of truth is the same MMKV files the app reads. A new Kotlin `ExpenseWidgetStore` reads index + items natively on every `onUpdate` and derives all numbers at render time (today/month/7d/recent), applying the same semantics as JS: drop `deletedAt`, `Math.abs(amount)`, single-currency grouping (never mixed sums — mirrors `groupExpensesByCurrency`), device-local day keys (`ZoneId.systemDefault`, `yyyy-MM-dd`), recent sorted newest-first.
- JS is a fast path only: a tiny `WidgetAssist` snapshot (`currency, locale, localized copy, categoryColors, dataVersion=max(updatedAt)`) written best-effort on mutations, plus bridge functions `refreshWidgets()` (broadcast) and `persistAssist(json)` (hint write). Correctness never depends on either. (No separate `labels` field: category labels come from live `app_settings`, with assist `categoryColors` keys as fallback.)
- Staleness rule (mirrors Ritulaya's `dataVersion` check): the assist carries no numbers, only the effective-currency hint and dot colors. The hint is trusted only when its `dataVersion` equals live `max(updatedAt)`; otherwise the settings default (then most-recent-row) currency wins. All totals always come from live rows.

### 2. Three providers, one data Module

- One deep Module `ExpenseWidgetStore` with interface `fun read(now, filter): WidgetResult` (`Ready | Empty | Unavailable`). Hides MMKV keys, JSON parsing, timezone, currency fallback, aggregation.
- One narrow `WidgetAssist` reader (`fun load(): Assist?`).
- Three thin provider Adapters at the `RemoteViews` seam: `Summary`, `Trend7d` (7 bars drawn to a bitmap with `Canvas` — `RemoteViews` cannot host chart views and pre-S cannot set layout weights dynamically; zero-filled with faint track slots), `Recent` (`RemoteViewsService` list, capped at 8).
- One bridge Module `ExpenseBuddyWidgetModule` with `refreshWidgets()` (broadcast, no data params) plus `persistAssist(json)` (hint write). Broadcasts use string `ComponentName`s, never `Class.forName`, so they survive release obfuscation.

### 3. v1 scope limits

- Per-instance filter is `category + hideAmounts` only (stored in `expense_widget_<id>` prefs). Full `FilterState` parity (time/method/instrument/search) stays in-app.
- No widget-side editing or quick-add-without-app. Taps deep-link into the app (`myapp://` home/Analytics tab, `myapp://add` from `+`, `myapp://history` from list rows and labels).
- The `android:configure` screen is a full-screen activity (a dialog window clipped labels and buttons); it writes per-instance prefs and returns `RESULT_OK`.
- Theming uses explicit light/dark token pairs mirroring `constants/palette.ts`, selected from the native-read `app_settings.theme` preference (with device `uiMode` for `system`), not dynamic Material You. This keeps launcher-hosted `RemoteViews` aligned with the app even when its preference differs from the device. `hideAmounts` covers lock-screen privacy, including empty totals.
- Resizing triggers a native rerender; Trend sizes its bitmap from the widget options rather than stretching one fixed bitmap. Date labels use the app-language locale from assist and Android locale-aware compact date formatting.
- Freshness without JS: system receiver (`ACTION_DATE_CHANGED` midnight rollover, plus `TIME_SET`/`TIMEZONE_CHANGED` since day keys are zone-local, `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`) + 30-min `WorkManager` backstop armed on first `onEnabled`. `updatePeriodMillis=0`.

## Consequences

### Positive

- Widgets stay correct with the app killed, after sync-while-closed, and across reboots — same guarantee Ritulaya gets from Room, without migrating expenses to Room.
- One aggregation owner in Kotlin; providers stay thin; JS/TS analytics untouched.
- Small bridge surface: one broadcast function, one assist writer.

### Negative

- MMKV must be added as a native dependency of the new module (`io.github.zhongwuzw:mmkv`, same coordinates as `react-native-mmkv` so Gradle dedupes the classes — not `com.tencent:mmkv`, which ships identical classes under different coordinates and breaks the build), read in multi-process mode; JS and widget race on the same file (tolerated: reads are best-effort, JS heals corrupt index on next launch).
- Aggregation logic exists twice (TS + Kotlin) with a parity contract to maintain (day keys, abs amounts, single-currency grouping, zero-fill, newest-first recent). Mitigated by focused unit tests on both sides asserting the same invariants.
- `RemoteViews` limits: no real charts (bars are a rendered bitmap), no custom fonts — lists are plain rows.

## Rejected alternatives

1. **JS-push-only snapshot in `SharedPreferences`.** Rejected: stale whenever the process is dead; makes the widget a second source of truth.
2. **Migrate expenses to Room for widgets.** Rejected: massive migration for a read-only surface; MMKV is already natively readable.
3. **Full filter parity per widget instance.** Rejected for v1: overwhelming on a 4x1 surface and duplicates `FilterState` complexity in Kotlin.
