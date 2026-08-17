# NativeWind Conversion Guide

Mechanical reference for converting files off Tamagui. Apply per-file, preserving
behavior exactly. `components/ui` primitives already exist: `Button`, `Card`,
`Input`, `Label`, `Switch`, `RadioGroup`, `Spinner` (see `components/ui/`).

## Imports

- `import { YStack, XStack, Text, Button, Card, Input, Label, View, ScrollView, H4, H6 } from "tamagui"` →
  `import { Text, View, ScrollView } from "react-native"` + the primitives you use:
  `import { Button } from "../../components/ui/Button"` (adjust relative path).
- Icons: `@tamagui/lucide-icons-2` → `lucide-react-native` (same named exports).
- `useTheme` from `tamagui` → `useThemeColors` from `hooks/use-theme-colors`.
- `getColorValue` from `tamagui.config` → drop it; pass the string directly.
- `constants/theme-colors` still works (re-exports `constants/palette`).

## Theme access

- `useTheme().background.val` → `useThemeColors().background`
- `useTheme().color.val` → `.foreground`; `.borderColor.val` → `.border`
- `theme.backgroundHover` → `theme.surface`; `theme.backgroundPress` → `theme.muted`
- `$background` / `$color` / `$borderColor` props → className `bg-background` /
  `text-foreground` / `border-border`.

## Layout primitives

- `YStack` → `View` (add `gap-*`, `items-*`, `justify-*`, `flex-1`, padding classes).
- `XStack` → `View className="flex-row ..."`.
- Tamagui `ScrollView` → RN `ScrollView` (props differ slightly; add `className`).
- `items="center"` → `items-center`; `justify="space-between"` → `justify-between`.

## Tokens → className

Spacing (`UI_SPACE` / `$token`): micro→`1`(4px), control→`2`(8px), section→`3`(12px),
gutter→`4`(16px), block→`5`(20px), empty→`10`(40px). e.g. `gap="$control"`→`gap-2`,
`px="$section"`→`px-3`, `mt={UI_SPACE.control}`→`mt-2`, `p={UI_SPACE.gutter}`→`p-4`.

Radius (`UI_RADIUS` / `rounded`): control→`rounded-control`, chip→`rounded-chip`,
surface→`rounded-card`, round→`rounded-round`.

Opacity (`UI_OPACITY`): use className `opacity-<0-100>` (subtle=60, faint=50,
ghost=40, medium=70, strong=80) or keep `style={{ opacity }}`.

Font size (`$body` etc.): micro→`text-[11px]`, caption→`text-xs`, body→`text-[13px]`,
label→`text-sm`, title→`text-base`, sectionTitle→`text-lg`, screenTitle→`text-xl`.

## Components

- `Button`: `size="$chip"`→`size="chip"`, `theme="accent"`→`variant="accent"`,
  `icon={Filter}`→render `<Filter size={16} />` as a child, `<Button.Text>..</Button.Text>`→`<Text>..</Text>`.
  `rounded={UI_RADIUS.round}`→ add `className="rounded-round"`.
- `Card` → `components/ui/Card`. `Text`/`Label`/`Input` → respective primitives or RN `Text`.
- `Switch`/`Switch.Thumb` → `components/ui/Switch` (`checked`/`onCheckedChange`).
- `RadioGroup`/`.Item`/`.Indicator` → `components/ui/RadioGroup` (`.Item` only; the
  dot renders automatically when selected; keep `Label`/`Text` as siblings).
- `Spinner` → `components/ui/Spinner`.
- `H4`/`H6` → `Text className="text-lg font-semibold"` (H4) / `text-base` (H6).
- `styled(X, {...})` → build with `cn()` on the underlying component.
- `Sheet`/`Dialog`/`Accordion` → see `AppSheetScaffold` (Modal), `history.tsx`
  (Dialog), `PaymentInstrumentsSection.tsx` (Accordion) after conversion.

## Gotchas

- `text="center"` (Tamagui textAlign) → `text-center`.
- `numberOfLines` is a valid RN `Text` prop — keep.
- `flex={1}` on a row child → `flex-1`.
- Do not translate `pointerEvents="none"` — keep as prop.
- `px`/`py`/`mt`/`mb` numeric props → tailwind `px-N`/`py-N`/`mt-N`/`mb-N`.
