---
"expense-buddy": minor
---

Upgrade Tamagui from v1 to v2 and migrate all component APIs to v5 shorthands.

### Tamagui v2 Migration

- Upgrade core dependencies: `tamagui`, `@tamagui/core`, `@tamagui/config` to v2
- Migrate `@tamagui/lucide-icons` to `@tamagui/lucide-icons-2` with individual icon imports (80% bundle reduction)
- Replace `themeInverse` prop with `theme="accent"` across 22 files
- Replace `bordered` prop with `borderWidth={1} borderColor="$borderColor"` pattern
- Migrate accessibility props to `aria-*` equivalents (7 files)
- Migrate longhand style props to v5 shorthands across 10 files (38 violations fixed)
- Update Tamagui provider and config for v2/v5
- Remove unused `babel-plugin-transform-jsx` dependency
- Resolve Tamagui v2 type errors: `bordered`, `theme` prop, provider, section header (4 files)
- Standardise Input/TextArea dark mode with `bg="$background"` across 11 files (26 instances)
- Enforce full property name → shorthand conversion per Tamagui `onlyAllowShorthands` config

### Styling — Theme Token Extraction

- Extract hardcoded view values into reusable constants: `UI_OPACITY`, `UI_FONT_WEIGHT`, `UI_BORDER_WIDTH`, `UI_ICON_SIZE` in `constants/ui-tokens.ts`
- Replace ~250 hardcoded values (opacity, fontWeight, borderWidth, icon sizes, maxWidth) across 55+ files with token constants
- Second pass: replace remaining 42 values across 13 files (CategorySection, FilterSheet, LineChartSection, SmsImportReviewScreen, settings, etc.)

### SMS Import — Dedup Reliability

- Deduplicate review items by content fingerprint (sender + body + 3-minute time window) instead of ID alone
- Apply NFKD unicode normalization to SMS body before regex matching and fingerprint hashing
- Update native Kotlin `BackgroundSmsParser` to apply same NFKD normalization and 3-minute time window
- Remove accepted items from review queue after expense creation

### Settings Sync — Background SMS Permission

- When synced settings enable `backgroundSmsImportEnabled`, request RECEIVE_SMS + POST_NOTIFICATIONS on device
- Automatically turn off the toggle if the user denies the permission request
- Applied in both auto-sync (StoreProvider) and manual-sync (useSettings hook)

### Performance Optimizations (10 items)

- Hoist `Intl.NumberFormat` with module-level cache in `utils/currency.ts`
- Replace barrel import `utils/analytics-calculations` with direct sub-module imports (15 files)
- Stabilize `ExpenseRow` `onPress` callbacks via `useRef` + `useCallback`
- Cache fallback `categoryInfo` objects per label in 3 screens
- Add `startTransition` wrappers on filter/currency state updates (3 screens)
- Lazy-initialize `useState(() => new Date())` in add screen
- Replace `<FlatList>` with `<FlashList>` in repo-picker
- Extract `SectionList` `renderItem`/`keyExtractor` to `useCallback` in day detail screen
- Memoize currency buttons and category cards with stable handlers
- Extract inline styles from `.map()` loops to stable references (6 files)

### Verification

- TypeScript: 0 errors
- ESLint: clean
- Tests: 83 suites, 749 tests passing
