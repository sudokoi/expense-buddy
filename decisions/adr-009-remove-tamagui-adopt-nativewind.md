# ADR-009: Remove Tamagui, Adopt NativeWind, Upgrade to Expo SDK 57

**Date:** 2026-08-17
**Status:** Accepted

---

## Context

The app styles every screen with Tamagui v2. Tamagui is the only styling dependency and is woven through 60 of 62 files under `app/` and `components/`, but it has become a liability:

- **Upgrade instability**: Tamagui routinely breaks across patch/minor releases. Its build surface spans three moving parts — `@tamagui/babel-plugin`, `@tamagui/metro-plugin`, and the generated `tamagui-web.css` — so a patch bump can silently change generated class names or sub-theme semantics.
- **Large generated artifacts**: `tamagui.config.ts`, `.tamagui/` (~5.6 MB generated JSON), and `tamagui-web.css` (~298 KB) must be checked in and kept in sync with the config.
- **Indirection without payoff**: The app uses only a small set of primitives (`Text`, `YStack`, `XStack`, `Button`, `Card`, `Input`, `Label`, `View`, `ScrollView`, `Sheet`, `Dialog`, `Accordion`, `Switch`, `RadioGroup`, `Spinner`) and 30 Lucide icons. There is no use of Tamagui's advanced compiler features that justify the build complexity.
- **Theme tokens are fragmented**: the "kawaii" palette is defined in three places (`tamagui.config.ts`, `constants/theme-colors.ts`, `constants/ui-tokens.ts`) plus the generated CSS, and `ui-tokens.ts` reaches into Tamagui's `getVariableValue` just to read its own numbers back.
- **Contrast failures**: a design audit found the interactive accent (`#FFB6C1`) reaches only **1.57:1** contrast against the cream background (`#FFF8F0`), and the muted text (`#8B7B96`) reaches 3.71:1 — both below WCAG AA. Selected tab/filter states are nearly invisible.

A sibling app (ritulaya) already runs a stack the author prefers: NativeWind 4 + Tailwind, `class-variance-authority`/`clsx`/`tailwind-merge` for variants, `lucide-react-native` for icons, and a single `palette.ts` + `global.css` + `tailwind.config.js` theme source. This ADR aligns Expense Buddy with that stack.

## Decision

Remove Tamagui entirely and replace it with NativeWind, while simultaneously upgrading to the current Expo SDK.

### Target stack

| Concern      | From                                                                     | To                                                                                   |
| ------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Styling      | Tamagui v2                                                               | NativeWind 4.2.6 + Tailwind 3.4 + `tailwindcss-animate` + `react-native-css-interop` |
| Variants     | Tamagui `styled()`                                                       | `class-variance-authority` + `clsx` + `tailwind-merge`                               |
| Icons        | `@tamagui/lucide-icons-2`                                                | `lucide-react-native`                                                                |
| Theme source | `tamagui.config.ts` + `theme-colors.ts` + `ui-tokens.ts` + generated CSS | `constants/palette.ts` + `global.css` CSS variables + `tailwind.config.js`           |
| Platform     | Expo SDK 54 / RN 0.81 / React 19.1                                       | Expo SDK 57 / RN 0.86 / React 19.2.3                                                 |

The SDK 57 upgrade is bundled here because NativeWind's config (babel preset, metro plugin) and the new theme tokens are version-specific, and aligning with ritulaya avoids carrying two version targets. SDK 55+ requires the **New Architecture**; the app's custom Expo modules (`expense-buddy-*`) are JSI/TurboModule-based and New-Architecture-ready, but this is a risk to validate during migration (see Consequences).

### Migration approach

1. **Scaffold**: add NativeWind/Tailwind config (`tailwind.config.js`, `global.css`, `nativewind-env.d.ts`), update `babel.config.js` and `metro.config.js`, and remove all Tamagui build plugins.
2. **Theme port**: rewrite `theme-colors.ts`/`ui-tokens.ts` as `palette.ts` + CSS variables + Tailwind tokens, and fix the contrast failures in the same pass (split _decorative pastel_ fills from _interactive accent_ foregrounds).
3. **Primitive layer**: build small `components/ui` primitives (`Button`, `Card`, `Input`, `Label`, `Switch`, `RadioGroup`, `Spinner`, `Text`, `Sheet`/`Modal`, `Dialog`, `Accordion`) with CVA, preserving existing public APIs.
4. **Screen-by-screen swap**: convert all 60 files (`YStack`/`XStack` → `View` with className, `useTheme()` → `useThemeColors()`, remove `getColorValue`/`.val` wrapping).
5. **Icons**: swap `@tamagui/lucide-icons-2` → `lucide-react-native` (same names and props).
6. **Cleanup**: delete `tamagui.config.ts`, `.tamagui/`, `tamagui-web.css`, the jest mock, and all `@tamagui/*` dependencies.

No functional changes are expected. Existing component abstractions (`AppSheetScaffold`, `ScreenContainer`, filters, analytics, settings) keep their interfaces.

## Consequences

### Positive

- Removes three coordinated build-time dependencies and ~6 MB of generated artifacts.
- Eliminates the recurring Tamagui patch/minor breakage class.
- Single source of truth for theme tokens, mirroring the ritulaya pattern the author prefers.
- Direct, auditable styling via Tailwind utilities and CSS variables — no compiler magic or generated class names.
- Icons become first-party `lucide-react-native` with plain `color`/`size` props (no `getColorValue` shim).
- Fixes the WCAG contrast failures as part of the theme port.
- One-time alignment with the current Expo SDK, reusing the tooling and dependencies already proven in ritulaya.

### Negative

- Large mechanical refactor across ~60 files; requires a dedicated branch and careful per-screen verification.
- New Architecture (SDK 55+) is a mandatory platform change with the SDK upgrade. Risk areas: `react-native-reanimated` 4 (already New-Arch-only), `@shopify/flash-list` 2.x, `react-native-keyboard-controller`, and the custom `expense-buddy-*` native modules.
- No drop-in equivalent for Tamagui `Sheet` snap points; `AppSheetScaffold` must be reimplemented on RN `Modal`.
- Transient build breakage between the SDK upgrade and the Tamagui removal (they land in the same branch; intermediate commits may not bundle).
- Temporary divergence from the established Tamagui-based `components/ui` conventions until the swap completes.

## Rejected alternatives

1. **Keep Tamagui, pin versions.** Removes the breakage symptom but not the underlying build complexity, generated artifacts, or token fragmentation, and the author already prefers the NativeWind stack.

2. **Migrate to a different UI kit (Dripsi, Restyle, styled-components, or a shadcn-style component library).** These either re-introduce a compiler/theme runtime similar to Tamagui or add a third-party component dependency the app does not need. The app's primitives are small enough to own directly.

3. **Restyle only, defer the Expo upgrade.** Would carry two toolchain targets and require a second theme re-port immediately afterward; NativeWind config is version-specific, so doing both at once is cheaper.

4. **Use NativeWind without Tailwind tokens (inline arbitrary values).** Forfeits the single-source-of-truth theme and the accessibility fixes; rejected in favor of the `palette.ts` + CSS-variable pattern.

## Related

- ARCHITECTURE.md: runtime layers and component boundaries (unchanged by this migration)
- constants/theme-colors.ts, constants/ui-tokens.ts: current theme sources being consolidated
- ritulaya (`~/code/ritulaya`): reference implementation of the target stack
