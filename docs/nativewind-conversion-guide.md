# Styling & Theming Guide (NativeWind)

The app is styled with **NativeWind 4** (Tailwind for React Native) on plain React Native
primitives. There is no runtime CSS-in-JS: `className` utilities compile to
native style objects at build time. This guide is the canonical reference for how styling
works today. `components/ui` primitives already exist: `Button`, `Card`, `Input`, `Label`,
`Switch`, `RadioGroup`, `Spinner` (see `components/ui/`).

## Imports

- Primitives: `import { Text, View, ScrollView, Pressable } from "react-native"` plus the
  shared `components/ui` primitives you use, e.g.
  `import { Button } from "../../components/ui/Button"` (adjust the relative path).
- Icons: `import { Sun, Moon, Check } from "lucide-react-native"` (named exports;
  `color`/`size` props).
- Theme: `useThemeColors` / `useThemeScheme` from `hooks/use-theme-colors`.
- Helpers: `cn` from `utils/cn`, `cva` from `class-variance-authority`.
- `constants/theme-colors` still works (re-exports `constants/palette`).

## Theme access

- `useThemeColors().background` → background fill; `.foreground` → primary text;
  `.surface` → elevated surface; `.border` → hairline borders; `.accent` → interactive
  accent; `.accentForeground` → text on the accent; `.muted` / `.mutedForeground` →
  secondary surfaces/text.
- `useThemeScheme()` → `"light" | "dark"` for callers that only need the mode
  (e.g. chart/overlay color selectors).
- For `style`-based colors, read from `useThemeColors()` or the `constants/theme-colors`
  helpers (`getNotificationColor`, `getChartColors`, `getOverlayColors`,
  `getReadableTextColor`).

## Layout primitives

- Vertical stack → `<View className="flex-col gap-2 ..." />`.
- Horizontal stack → `<View className="flex-row items-center ..." />`.
- RN `ScrollView` → add `className`; props differ slightly from web.
- `items="center"` → `items-center`; `justify="space-between"` → `justify-between`;
  `flex={1}` → `flex-1`.

## Tokens → className

Spacing (`UI_SPACE`): micro→`1`(4px), control→`2`(8px), section→`3`(12px),
gutter→`4`(16px), block→`5`(20px), empty→`10`(40px). e.g. `gap="$control"`→`gap-2`,
`px="$section"`→`px-3`, `mt={UI_SPACE.control}`→`mt-2`, `p={UI_SPACE.gutter}`→`p-4`.

Radius (`UI_RADIUS`): control→`rounded-control`, chip→`rounded-chip`,
surface→`rounded-card`, round→`rounded-round`.

Opacity (`UI_OPACITY`): use `opacity-<0-100>` (subtle=60, faint=50, ghost=40, medium=70,
strong=80) or keep `style={{ opacity }}`.

Font weight (`UI_FONT_WEIGHT`): `font-normal`(400), `font-medium`(500), `font-semibold`(600),
`font-bold`(700).

Font size: micro→`text-[11px]`, caption→`text-xs`, body→`text-[13px]`, label→`text-sm`,
title→`text-base`, sectionTitle→`text-lg`, screenTitle→`text-xl`.

Border width (`UI_BORDER_WIDTH`): thin→`border`, normal→`border-2`, thick→`border-[3px]`.

Icon size (`UI_ICON_SIZE`): map to `size={N}` on the lucide icon (small=16, regular=18,
medium=20, large=24, xlarge=32, …).

## Components

- `Button`: `size="chip"`→`size="chip"`, `variant="accent"`→`variant="accent"`,
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
  (Dialog), `PaymentInstrumentsSection.tsx` (Accordion).

## Variants with `cva`

```tsx
import { cva } from "class-variance-authority"
import { cn } from "@/utils/cn"

const buttonVariants = cva("flex-row items-center justify-center rounded-control", {
  variants: {
    variant: { accent: "bg-accent", outline: "border border-border bg-transparent" },
    size: { chip: "h-7 px-3", control: "h-11 px-4" },
  },
  defaultVariants: { variant: "accent", size: "control" },
})
```

## Gotchas

- **Static class strings only.** Never construct class names from variables
  (`bg-${color}`) — the compiler purges them. Use complete strings with conditional logic.
- `text="center"` (RN textAlign) → `text-center`.
- `numberOfLines` is a valid RN `Text` prop — keep.
- Do not translate `pointerEvents="none"` — keep as a prop.
- `px`/`py`/`mt`/`mb` numeric props → tailwind `px-N`/`py-N`/`mt-N`/`mb-N`.
- Keep `global.css`, `tailwind.config.js`, and `constants/palette.ts` in sync when changing
  a token — `palette.ts` is the single source of truth.
- Dark mode: the scheme is set at the app root from the user's theme preference. Semantic
  classes (`bg-background`, `text-foreground`, …) switch automatically; for `style`-based
  colors, read `useThemeColors()` / `useThemeScheme()`.
