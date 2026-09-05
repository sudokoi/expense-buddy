# UI readability and interaction pass

This pass preserves the warm light/dark palette and existing expense, filter, and
sync workflows. It covers the full route/component tree, not only the screenshot
viewports.

## Initial pass: changes by area

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

## Follow-up: settings, payment entry, and Edit Expense

- Payment Settings now shows its default choice directly, without a duplicate
  summary card. Saved instruments use compact nickname/method/masked-digit rows;
  tapping a row expands its form inline. Adding an instrument also uses an inline
  form, not a modal. Removal retains the existing confirmation.
- Category rows show usage counts. Search narrows the list; a separate reorder
  mode exposes accessible move buttons only when viewing the full order. Boundary
  moves are disabled and “Other” remains last. Deletion confirmation/reassignment
  is still owned by the payment screen.
- Language, currency, SMS region, and default payment choices open scrollable
  single-selection sheets. Dismissal changes nothing. Language changes retain the
  confirmation about resetting currency and SMS region.
- Payment entry shows saved instruments as directly selectable, wrapping choices.
  The digits input is always available; editing digits switches to one-off details
  without modifying a saved instrument. Creating an instrument adds a nickname
  inline and reuses the entered digits, with the existing validation. Unavailable
  historical instruments are explained without silently changing expense data.
- Edit Expense matches Add's amount-first hierarchy, localized date, collapsible
  payment summary, and keyboard-aware scrolling.
  Invalid amounts show an inline error; currency and save semantics are unchanged.
- Add and Edit have pinned keyboard-sticky actions outside their scroll areas.
  Add has “Add” and “Add another” side by side directly above the tabs, with no
  Cancel action. Add saves and opens History; Add another saves and resets the
  form for the next expense. Edit keeps Cancel on the left and Save on the right;
  cancellation discards only its unsaved edits.
  Footer height is measured for focused-input clearance; Add accounts for the
  tab bar below it. Invalid amounts scroll back to the fields.
- History retains compact content but restores the shared rounded, fully bordered
  card surface with spacing between expenses, following user feedback. Edit and
  Delete are directly accessible buttons, with no intermediate action prompt.
  Tap-to-edit and the final deletion confirmation remain.
- Tabs keep the navigator's press handling and static selected styling, but disable
  the ripple, opacity press effect, and screen transition animation.
- App Information groups current/latest version details alongside Check for
  Updates, with Report Issue and GitHub actions sharing a wrapping row. Available
  update/install actions are retained.
- Analytics no longer duplicates currency selection below Total Spent. Currency
  changes remain in the shared Filters screen; existing amount formatting is unchanged.
- Analytics shows Sync Now only when a GitHub sync configuration is saved, matching
  Settings' existing guard for manual sync, pending changes, and auto-sync options.
  GitHub setup and SMS import remain available without a sync configuration.
  Verified both screens in the unconfigured Android preview; authenticated sync
  was not exercised for this visibility-only change.
- Spending Trend uses the chart library's 18dp single-line X-axis label box and
  shifts any font-scaled height downward. A taller box without that offset lifts
  the bottom-anchored date labels into the plot.

### Form action styling

- Primary submission actions (Add, Save) use `accent`: filled accent background.
- Adjacent secondary actions (Cancel in Edit, Add another in Add) use `outline`:
  a visible rounded border and surface background, with the same touch-target size.
- `ghost` is for lower-emphasis tertiary actions, not the paired Cancel action in
  the persistent Edit footer. Button role depends on context, not its label alone.

### Follow-up checks

- JavaScript: 90 suites, 814 tests passed, including 14 new cases for instrument
  choices and category ordering. Kotlin tests, typecheck, ESLint, translation
  parity, and theme checks passed.
- Android preview: created a saved card; moved a category down and back up; checked
  empty category search, disabled reorder while searching, and clear recovery.
  Selected manual digits and a saved card in Add, saved an expense, edited its
  amount, and confirmed History retained its payment details. Empty Edit amount
  showed validation and did not save.
- Language-change cancellation preserved all three localization values; currency
  and region choices updated their summaries independently. Light/dark surfaces,
  rounded History cards, and Payment Settings/selection sheet at 150% text were
  inspected. Emulator font scale was restored to 1.0.
- Further feedback checks: direct History Edit navigation and Delete confirmation
  (cancelled without deleting); inline saved-instrument creation with nickname
  validation and reuse of entered digits; inline Payment Settings form; compact
  App Information. Before the final action-label revision, Add cancellation kept
  an `88` amount draft and did not change the saved History total; that temporary
  Cancel action has since been removed at the user's request.
- Docked Android keyboard: Add's footer remained above the keyboard; Edit scrolled
  the focused note input above its footer. Add's earlier Cancel/Save row was inspected
  at 150% text with the keyboard open. Font scale and keyboard preferences were
  restored after testing.
- Trend label regression: a temporary Android screenshot/UI-bounds probe measured
  the date starting 34px above the X-axis before the fix, and 13px below afterward
  at both 100% and 150% system text. The 16 trend utility tests, typecheck, and
  chart ESLint check passed. Pixel positioning was validated natively, not by the
  Node-only utility suite; the checked fixture has a single daily point.
- The original app and reference screenshots remain untouched. This follow-up
  used the existing preview installation, not a new native build. Full TalkBack,
  locale/device matrices, landscape, and populated SMS flows
  remain outside the completed smoke checks.
