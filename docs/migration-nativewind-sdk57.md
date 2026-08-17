# Migration Plan: Tamagui → NativeWind + Expo SDK 57

> **Status: Completed (2026-08-17).** Every phase below is done — Tamagui has been fully
> removed and the app now styles with NativeWind on React Native primitives. This document
> is retained as a historical record of the migration.

Branch: `feat/remove-tamagui-nativewind-sdk57`
ADR: [ADR-008](decisions/adr-008-remove-tamagui-adopt-nativewind.md)

Goal: remove Tamagui, adopt NativeWind/Tailwind, upgrade to Expo SDK 57, and fix the
design audit's contrast failures — **with no functional change**.

## Phases

### 0. Branch + docs

- [x] New branch, ADR, this plan.

### 1. Scaffold + SDK upgrade

- Update dependencies to Expo SDK 57 / RN 0.86 / React 19.2.3 (`expo install --fix`).
- Add NativeWind/Tailwind deps and `lucide-react-native`.
- Add `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`; wire `babel.config.js`
  (`nativewind/babel`) and `metro.config.js` (`withNativeWind`).
- Remove Tamagui build plugins from babel/metro.

### 2. Theme port + contrast fixes

- Replace `constants/theme-colors.ts` + `constants/ui-tokens.ts` with
  `constants/palette.ts` (single source of truth), `global.css` CSS variables, and
  Tailwind color/radius tokens.
- Split _decorative pastel_ fills from _interactive accent_ foregrounds so interactive
  states meet WCAG AA (fix `#FFB6C1` = 1.57:1 accent and `#8B7B96` = 3.71:1 muted text).

### 3. Primitive layer (`components/ui`)

- Build CVA-based primitives preserving existing props: `Button`, `Card`, `Input`,
  `Label`, `Text`, `Switch`, `RadioGroup`, `Spinner`, `View`, `ScrollView`.
- Reimplement complex primitives behind existing abstractions: `AppSheetScaffold`
  (Sheet → RN `Modal`), `Dialog`, `Accordion`.

### 4. Screen-by-screen swap (60 files)

- `YStack`/`XStack`/`Stack`/`View` → `View` + className; `Text`/`H4`/`H6` → `Text` +
  className; `useTheme()` → `useThemeColors()`; remove `getColorValue`/`.val` and
  `$token` props.

### 5. Icons

- `@tamagui/lucide-icons-2` → `lucide-react-native` (same names, plain `color`/`size`).

### 6. Cleanup + verify

- Delete `tamagui.config.ts`, `.tamagui/`, `tamagui-web.css`, jest mock, `@tamagui/*` deps.
- Run `yarn typecheck`, `yarn lint`, `yarn test`, `npx expo-doctor`.

## File inventory

- 60 UI files import Tamagui; 62 total `.tsx`/`.ts` under `app/` + `components/`.
- Primitives by usage: `Text`(173), `YStack`(161), `XStack`(93), `Button`(86),
  `Label`(48), `Input`(26), `Card`(21), `View`(19), `ScrollView`(13), `Accordion`(12),
  `Switch`(10), `Stack`(10), `Dialog`(7), `H4`(6), `Tabs`(5), `RadioGroup`(5),
  `Sheet`(4), `Spinner`(1), `H6`(1).
- Icons: 30 Lucide glyphs via `@tamagui/lucide-icons-2` (1:1 to `lucide-react-native`).
- Complex primitives are centralized: `Sheet` → `components/ui/AppSheetScaffold.tsx`,
  `Dialog` → `app/(tabs)/history.tsx`, `Accordion` →
  `components/ui/settings/PaymentInstrumentsSection.tsx`.

## Risks

- **New Architecture** (mandatory on SDK 55+): validate `react-native-reanimated` 4,
  `@shopify/flash-list` 2.x, `react-native-keyboard-controller`, and the
  `expense-buddy-*` native modules.
- **Sheet snap points** have no NativeWind equivalent; `AppSheetScaffold` is the single
  choke point.
- Intermediate commits between phases 1 and 4 may not bundle; verify at phase 6.
