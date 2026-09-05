# UI, theme, and localization audit

Audited the app route/component tree, screen hooks/providers, display helpers,
service feedback, and Android widget/SMS presentation after the compact-control
and shared-dialog work. This is a source audit with targeted Android smoke
checks, not a claim of complete device or accessibility certification.

## Findings addressed

| Area             | Finding and correction                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared styling   | Repeated numeric icon sizes now use `UI_ICON_SIZE`; body/micro text, content widths, legend/metric/action widths, and empty-chart heights use named Tailwind aliases. Sheets and dialogs share a palette-owned backdrop.                                                                                                                                             |
| Theme mismatches | `SyncIndicator` had an undefined `rounded-surface` class and a light-only spinner accent. Category icons could inherit Lucide's black default. Both now follow the effective theme. AmountText uses theme-aware semantic foregrounds rather than fixed amount colors.                                                                                                |
| Readability      | Helper text in Settings, Analytics, and SMS review uses the tested muted foreground instead of low opacity. Destructive buttons deliberately retain white on their theme-invariant red fill.                                                                                                                                                                         |
| Locale keys      | Four keys were absent from every bundle: pending changes and three sync status labels. Picker accessible labels, payment identifier labels/abbreviations, language choices, version labels, conflict details, and sync summaries now resolve through locale keys. Raw unexpected errors at reviewed UI catch boundaries are logged with localized fallback feedback. |
| Native copy      | SMS notification/channel copy and widget first-launch fallbacks use Android resources, with Hindi and Japanese translations. Widgets still prefer app-localized assist copy. Native resource fallbacks follow Android's locale, which may differ from an explicit in-app language override.                                                                          |
| Checks           | Translation checking now validates literal call sites and native resource key parity, not just bundle parity. Theme checking reads the actual palette declarations and checks numeric aliases, semantic foregrounds, and Android widget colors. Regression tests cover UI source conventions, localized copy, contrast, and native fallback resources.               |

## Styling policy and deliberate exceptions

- **48dp minimum:** task-completion actions, paired Cancel actions, direct
  Edit/Delete controls, filter-opening buttons, and existing full-sized inputs.
- **40dp minimum:** compact filters, preferences, category/payment choices,
  applied-filter summaries, and category icon/color grids. This is below Android's
  recommended 48dp target. Long labels and two-line instruments grow; the
  “No identifier” surface stretches to match other cards in its row.
- Tailwind's standard spacing, font, opacity, border, and radius utilities are
  part of the styling scale. Zero, flex weights, percentages, and geometry ratios
  are layout instructions, not missing theme values.

Documented component-only geometry (not global theme variants):

| Location                                                           | Reason for one-off values                                                                                                                                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ui/SettingsSection.tsx`                                | 22dp decorative glyph balances a 40dp tinted badge.                                                                                                                                           |
| `components/ui/ChangelogSheet.tsx`                                 | Markdown line boxes, compact code corners, and document spacing differ from form controls. Font sizes/weights still use shared tokens; monospace is for code content.                         |
| `components/NotificationStack.tsx`                                 | A soft, colored notification shadow and slightly tighter internal spacing differ from ordinary cards.                                                                                         |
| `components/analytics/LineChartSection.tsx` and payment pie charts | Plot dimensions, ring ratios, point spacing, and label offsets are chart geometry. The trend label's font-scale correction prevents overlap with the axis. Slice labels remain disabled.      |
| `app/(tabs)/_layout.tsx`, `hooks/use-tab-bar-height.ts`            | Navigator icon slots and font-scale clearance are not touch-target or typography tokens.                                                                                                      |
| `components/ui/AppDialog.tsx`, `AppSheetScaffold.tsx`, form routes | Viewport breakpoints, snap percentages, keyboard offsets, and footer clearances are component layout constraints.                                                                             |
| Native widget XML and renderers                                    | Android RemoteViews uses resource dimensions and drawing geometry, not NativeWind. Palette mirrors are checked; alpha ripple masks and monochrome tint masks are deliberate platform effects. |

## Localization boundaries

App-authored visible copy and accessibility labels use i18next or Android resource
keys. Language names are recognizable autonyms stored in each locale bundle.
Expense/category names, saved-instrument nicknames, SMS bodies, repository names,
release notes, technical identifiers (including Git branch `main`, icon names,
hex colors, currency codes, and masked digits), and diagnostics are data rather
than translatable UI copy. Canonical payment/category values remain unchanged in
storage; display labels are translated at presentation boundaries.

The static check validates literal translation calls. Computed keys still require
review/tests; it does not prove every possible runtime path or translation quality.

## Validation

Run the package scripts through Yarn:

```sh
yarn test
yarn typecheck
yarn lint
yarn format:check
yarn check:translations
yarn check:theme
yarn check:theme-flow
yarn changeset:status
```

`test` includes Kotlin tests; `lint` includes ktlint. ML checks are excluded from
this audit at the maintainer's request, and no ML source/lockfile changes are
included. The first parallel Jest run had a worker SIGSEGV; a normal script retry
passed. Formatting fixes use `yarn format`, including Kotlin formatting.

Earlier Android smoke checks covered 40dp choices, same-height instrument cards,
normal/150% text, filter draft cancellation, and Back/Cancel on shared dialogs.
Authenticated sync conflicts, populated SMS bulk actions, full TalkBack coverage,
and exhaustive small-width/landscape checks remain unverified. Native resource
tests validate locale fallback selection without sending notifications or altering
expense data.

Final automated result: **94 Jest suites / 866 tests**, Kotlin unit tests,
typecheck, lint (including ktlint), formatting, translations, and both theme
checks passed using the package scripts. All seven prior pending changesets were
replaced by one CLI-generated patch changeset, `curly-webs-boil.md`, covering the
combined UI work. This does not bump the version or create a release.

The final payment chart legends were also inspected on Android in light and dark
mode. Their combined amount/percentage values fit on one line at normal text;
the native row bounds retain 48dp targets with 4dp gaps. At 150% text in dark
mode, long instrument names wrap without clipping the combined value. Preview
preferences were restored to light mode and 100% text; language, currency, and
SMS region were unchanged.
