# UI readability and interaction pass

This pass preserves the warm light/dark palette and existing expense, filter, and
sync workflows. It covers the full route/component tree, not only the screenshot
viewports.

## Changes by area

| Area                 | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation           | Visible translated labels, a selected icon background, and extra height for larger text. Use the navigator's standard tab button so the full tab remains interactive.                                                                                                                                                                                                                                                                                       |
| Analytics            | One primary total with period context and secondary statistics. Fixed trend Y axis, daily buckets through 45 days, weekly through 180 days, monthly beyond that. Zero-spend periods remain visible. Exact values are available by tapping or using previous/next controls. Category ranking uses labeled bars rather than crowded doughnut labels. Payment doughnuts retain exact amounts/percentages in wrapping legends without overlapping slice labels. |
| Filters              | Discoverable wrapping choices with selected checkmarks; horizontally scrolling months; persistent Cancel/Apply actions; shared Analytics/History scope explained. Draft search and amount text update immediately, reset visibly, and validate before Apply. Amount labels and month choices follow the draft currency. Applied search/amount filters appear in tab summaries.                                                                              |
| Add/edit expense     | Prominent amount field on Add, secondary SMS import action, clear category/payment selection, localized dates, payment summary when collapsed, primary Save followed by “Save & add another.” Edit and SMS forms share improved selection controls.                                                                                                                                                                                                         |
| History              | Compact separated rows, neutral amounts, daily totals and result summaries. Tap a row to edit; the overflow menu provides Edit/Delete. Deletion still requires the existing confirmation. Notes are displayed as entered, not rewritten or silently shortened in storage.                                                                                                                                                                                   |
| Settings and pickers | Clearer section headings, less duplicated payment-settings content, translated payment summaries, explicit pending-sync copy instead of an unexplained bucket count. Larger radio/selection/icon targets, scrollable category/instrument/color sheets, safe-area and keyboard bounds, readable color-swatch checkmarks. Category deletion and GitHub disconnect prompt once, at their existing confirmation owner. Repository names use theme-aware text.   |
| SMS review           | Source SMS can be expanded instead of being permanently clipped. Exact localized amounts/dates, inline amount errors, confirmation for bulk acceptance and clearing resolved items, and reduced-motion support. Suggestion debug detail is development-only. Parsing and acceptance rules are unchanged.                                                                                                                                                    |

New copy is present in all five locale bundles. The existing English aliases are
unchanged. No storage schema, sync protocol, authentication behavior, or dependency
changes are required.

## Validation

- Regression tests cover trend thresholds, totals, locale week boundaries, partial
  buckets, zero-spend months, leap days, multi-year periods, non-mutation and scales.
- Amount-range tests cover empty/reset text, zero/open-ended bounds, invalid text,
  reversed bounds, immediate parsing, and math-entry preferences.
- The JavaScript suite passes: 88 suites, 800 tests.
- `yarn test:kotlin` passes (unchanged native suites).
- TypeScript, repository-wide JavaScript/TypeScript ESLint, translation parity,
  duplicate JSON key checks, and theme/token checks pass.
- Android debug build succeeds. A separate `com.sudokoi.expensebuddy.uipreview`
  installation was used because the installed app has a different signature;
  its data was not cleared or replaced.
- Native smoke checks: Add/save to History, daily/result totals, filter amount
  validation and disabled Apply, Reset followed by immediate search-and-Apply,
  empty-result recovery, single-point trend/readout, category/payment breakdown,
  light/dark navigation and Settings, and the instrument sheet.
- Add was inspected at 150% system text size; category choices wrap. Chart axis
  width and tab height account for font scale. The emulator font scale was restored.

## Remaining validation boundaries

- This is an Android-only app. TalkBack and a complete Android locale/device-size
  matrix have not been tested.
- Native chart scrolling over long histories and partial-period selection have
  utility coverage but still merit testing with a realistic multi-year ledger.
- A normal docked soft keyboard, landscape sheets, and nested color/icon pickers
  need a further device pass; this emulator used its floating handwriting input.
- Authenticated repository picking/sync and populated SMS acceptance were reviewed
  in code, not exercised against an account or personal messages.
- Last-sync metadata and imported-merchant cleanup were not invented: both need
  deliberate data/behavior decisions outside this presentation pass.

The reference `screenshots/` directory is user-owned and intentionally untouched.
