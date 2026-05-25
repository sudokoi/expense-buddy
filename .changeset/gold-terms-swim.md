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
- Migrate longhand style props to v5 shorthands across 4 components
- Update Tamagui provider and config for v2/v5
- Remove unused `babel-plugin-transform-jsx` dependency

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
- Tests: 83 suites, 747 tests passing
