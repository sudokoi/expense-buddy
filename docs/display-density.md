# Display density

Display density is an Android in-app preference under **Settings → General**,
beside Theme. **Standard** is the default; **Compact** immediately reduces
typography, spacing, controls, and actual touch bounds to fit more content.
The preference is device-local and excluded from GitHub settings sync.
Widgets and native widget configuration are outside its scope.

## Sizing contract

The authoritative profiles are in
[`constants/display-density.json`](../constants/display-density.json).
Geometry is in dp; font values are base sizes before Android text scaling.

| Role                                 | Standard     | Compact      |
| ------------------------------------ | ------------ | ------------ |
| Ordinary action/input minimum height | 48           | 36           |
| Icon action minimum box              | 48 × 48      | 36 × 36      |
| Choice target minimum box            | 40 × 40      | 32 × 32      |
| Choice visual minimum height         | 36           | 28           |
| Amount input minimum height          | 64           | 44           |
| History badge                        | 40 × 40      | 32 × 32      |
| Common screen gutter                 | 20           | 16           |
| Common section gap                   | 12           | 8            |
| Label/choice gap                     | 8            | 6            |
| Labeled tab base height              | 64           | 52           |
| Caption / label / title font         | 12 / 14 / 16 | 12 / 13 / 14 |
| Amount / total font                  | 24 / 30      | 20 / 26      |

Minimums allow content-driven growth and wrapping, including two-line instrument
choices. Compact preserves Android font scaling, the warm palette, font families,
rounded shapes, selected fills/checkmarks, currency symbols, and action hierarchy.
The smaller touch targets are an explicit opt-in product choice.

Tab height adds `Math.max(0, fontScale - 1) * 24 + insets.bottom` to the base.
Safe-area insets and keyboard dimensions are never scaled. Native Switch geometry
and navigation-header heights remain platform-managed.

## Implementation map

| Responsibility                                          | Location                                                                                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profiles, types, normalization, CSS variables, tab math | [`constants/display-density.json`](../constants/display-density.json), [`constants/display-density.ts`](../constants/display-density.ts)                                   |
| Local state and hydration revision guard                | [`stores/ui-state-store.ts`](../stores/ui-state-store.ts)                                                                                                                  |
| Sync read, async hydration, serialized persistence      | [`services/display-density-storage.ts`](../services/display-density-storage.ts)                                                                                            |
| Narrow selector and density tokens for components       | [`hooks/use-display-density.ts`](../hooks/use-display-density.ts)                                                                                                          |
| Stable root variable scope                              | [`providers/display-density-provider.tsx`](../providers/display-density-provider.tsx), [`components/Provider.tsx`](../components/Provider.tsx)                             |
| Bounded startup splash gate                             | [`app/_layout.tsx`](../app/_layout.tsx)                                                                                                                                    |
| Semantic utility aliases and class merging              | [`tailwind.config.js`](../tailwind.config.js), [`utils/cn.ts`](../utils/cn.ts)                                                                                             |
| Localized settings selector                             | [`components/ui/DisplayDensitySelector.tsx`](../components/ui/DisplayDensitySelector.tsx)                                                                                  |
| Shared tab/footer height                                | [`hooks/use-tab-bar-height.ts`](../hooks/use-tab-bar-height.ts)                                                                                                            |
| Source disclosure and recycling-aware consumers         | [`components/ui/SourceSmsAccordion.tsx`](../components/ui/SourceSmsAccordion.tsx), [`components/ui/SmsImportReviewScreen.tsx`](../components/ui/SmsImportReviewScreen.tsx) |

The storage key is `display_density_v1`, accessed through the shared MMKV adapter
and its fallback. Invalid values normalize to Standard. Late hydration cannot
overwrite a newer user choice; serialized writes ensure rapid taps persist the
last selection. Density does not enter `AppSettings` or its sync hash.

Use semantic density utilities for layout and typography, and the hook's numeric
tokens for native styles and chart geometry. Keep the variable scope present from
the first render in both modes: adding it later can remount NativeWind consumers.
Custom merge groups distinguish text sizes from colors and let amount-input
minimums override ordinary-input minimums. Do not mutate static tokens, change
root rem sizing, or transform-scale screens to implement density.

## State and interaction contracts

- Density must not participate in navigator, list, or editor keys. Preserve
  drafts, selections, filters, expansion state, chart selection, and list context
  while remeasuring content.
- Add's pinned footer keeps outlined **Add another** on the left and filled
  **Add** on the right. Edit keeps outlined **Cancel** and filled **Save**.
  Measured keyboard-sticky footers and labeled tabs remain coordinated.
- Source SMS starts collapsed in pending/resolved cards and the editor. Its
  full-width header has consistent gutters, a left label, a right chevron,
  and accessible expanded-state semantics. Transaction details stay left-aligned;
  action groups have balanced, centered contents and can wrap.
- Recycled review rows own expansion with `useRecyclingState(false, [item.id])`.
  The editor keys its accordion by item ID. Switching density preserves an open
  disclosure; opening a new editor starts it collapsed.
- Expense data, instruments, review decisions, accepted-expense links, and
  confirmation/save behavior are independent of the density preference.

## Validation evidence

Recorded September 10, 2026 on an isolated Pixel 8 API 36 emulator:
1080×2400px, 2.625px/dp (about 411dp wide), font scale 1.0. The debug package
`com.sudokoi.expensebuddy.uipreview` used an existing 4.1.2 native shell with
the feature's 4.2.3-based JavaScript. These are debug-layout measurements,
not fresh release-build results.

- Native bounds confirmed approximately **36dp actions**, **32dp choices**, and
  **44dp amount inputs** in Compact versus 48/40/64dp in Standard.
- With 30 synthetic expenses over five days, History showed **9 complete expenses
  instead of 6**. Row pitch fell from about 90dp to 64dp—roughly **29% shorter**.
- The same eight Add categories used **2 rows instead of 3**, placing the note
  field about **146dp earlier** in the form.
- Mounted density changes preserved the Add amount draft, category selection,
  expanded payment details, scrolled History context, and open pending/editor
  Source SMS disclosures. Resolved cards started collapsed. Instrument choices
  had equal row heights, closed-keyboard footers aligned, and Compact survived
  restarting the preview. The temporary synthetic-data harness was removed.
- Automated verification passed **100 Jest suites / 912 tests**, including local
  persistence, hydration races, write ordering/recovery, tab math, and semantic
  class merging. Typecheck, lint, formatting, translations, theme/theme-flow,
  changeset validation, and whitespace checks also passed.

### Outstanding validation

- Fresh-build docked-keyboard clearance for Add/Edit/SMS footers. The existing
  preview showed a floating IME toolbar, so keyboard-open clearance is unverified.
- TalkBack, narrow/landscape screens, and large-text/localization combinations.
- End-to-end Add/Add another, Edit Save/Cancel, filter Apply/Cancel, instrument
  editing, and SMS accept/reject/dismiss/bulk actions in both modes.
- Authenticated GitHub states and release-mode scrolling.

Related references: [UI audit](./ui-audit.md),
[UI improvements](./ui-improvements.md), and
[persistence model](../ARCHITECTURE.md#persistence-model).
