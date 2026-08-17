---
description: NativeWind styling conventions and theme color usage
---

# NativeWind Styling Guidelines

This project styles the UI with **NativeWind 4** (Tailwind for React Native) on top of
plain React Native primitives. There is no runtime CSS-in-JS: `className` utilities are
compiled to native style objects at build time by `nativewind/babel` + the Metro
`withNativeWind` transformer.

## The stack

- **Primitives**: React Native `View`, `Text`, `Pressable` (no third-party UI kit).
- **Utilities**: `className` Tailwind classes compiled by NativeWind.
- **Variants**: `class-variance-authority` (`cva`) + `clsx` + `tailwind-merge`.
- **Helpers**: `cn()` (`utils/cn.ts`) for conditional class merging.
- **Icons**: `lucide-react-native` (named exports; `color`/`size` props).
- **Theming**: a single palette in `constants/palette.ts`, mirrored into `global.css`
  (CSS variables) and `tailwind.config.js` (color/radius tokens). Resolved at runtime
  via `useThemeColors()`.

## Color rules

**Never hardcode colors in components.** Always use one of:

1. Semantic theme classes (`bg-background`, `text-foreground`, `border-border`,
   `bg-accent`, `text-accent-foreground`, `bg-error`, `bg-surface`,
   `text-muted-foreground`, …).
2. Theme color constants from `constants/theme-colors.ts` (`SEMANTIC_COLORS`,
   `FINANCIAL_COLORS`, `ACCENT_COLORS`, `CARD_COLORS`, …).
3. Helper functions `getNotificationColor()`, `getChartColors()`, `getOverlayColors()`,
   `getReadableTextColor()`.

```tsx
// ❌ BAD - hardcoded colors
const bg = isDark ? "#3A2F4D" : "#FFD1DC"
<View style={{ backgroundColor: "#FFB6C1" }}>

// ✅ GOOD - semantic theme classes
<View className="bg-background">
<Text className="text-foreground">

// ✅ GOOD - theme color constants
import { SEMANTIC_COLORS, ACCENT_COLORS } from "@/constants/theme-colors"
<View style={{ backgroundColor: SEMANTIC_COLORS.success }}>
```

### Resolving colors in JS

When a value must be computed (chart colors, dynamic tints, `style` props), read it from
the resolved palette instead of a class:

```tsx
import { useThemeColors, useThemeScheme } from "@/hooks/use-theme-colors"

const colors = useThemeColors() // palette[ scheme === "dark" ? "dark" : "light" ]
const bg = colors.background
const scheme = useThemeScheme() // "light" | "dark"
const chart = getChartColors(scheme)
```

## Styling priority

1. `className` Tailwind utilities for layout, spacing, color, radius, typography.
2. `cn()` to merge conditional/variant classes (e.g. `cn(base, isActive && "bg-accent")`).
3. `style` prop / `constants/ui-tokens.ts` numeric tokens only for values that cannot be
   expressed as a static class (dynamic numbers, animated values, `StyleSheet` math).

## Numeric tokens

For inline styles, use the numeric tokens in `constants/ui-tokens.ts` (kept in sync with
`tailwind.config.js`). Examples: `UI_SPACE` (micro/control/section/gutter/block/empty),
`UI_RADIUS` (control/chip/surface/round), `UI_OPACITY`, `UI_FONT_WEIGHT`,
`UI_BORDER_WIDTH`, `UI_ICON_SIZE`.

```tsx
import { UI_SPACE, UI_RADIUS } from "@/constants/ui-tokens"

<View style={{ padding: UI_SPACE.gutter, borderRadius: UI_RADIUS.surface }} />
```

## Static class strings only

NativeWind's compiler scans for **complete** class strings at build time. Never build
class names from variables — they will be purged:

```tsx
// ❌ BAD - dynamically constructed class is purged
<View className={`bg-${colorName}`} />

// ✅ GOOD - complete strings, chosen with logic
<View className={colorName === "error" ? "bg-error" : "bg-surface"} />
```

## Components

Build primitives with `cva` and `cn`; see `components/ui/` (`Button`, `Card`, `Input`,
`Label`, `Switch`, `RadioGroup`, `Spinner`). Keep their public APIs stable — screens
compose them with `className`.

```tsx
import { cva } from "class-variance-authority"
import { cn } from "@/utils/cn"

const buttonVariants = cva("flex-row items-center justify-center rounded-control", {
  variants: {
    variant: {
      accent: "bg-accent",
      outline: "border border-border bg-transparent",
    },
  },
  defaultVariants: { variant: "accent" },
})
```

## Icons

```tsx
import { Sun, Moon, Check } from "lucide-react-native"

// color accepts a hex string or a resolved theme color
<Sun size={18} color={colors.foreground} />
<Check size={16} color={ACCENT_COLORS.primary} />
```

## Dark mode

The scheme is driven by the user's theme preference (set at the app root). NativeWind's
`dark:` variants work, but this project resolves the full palette in JS via
`useThemeColors()`, so most components just use the semantic classes
(`bg-background` switches automatically). For `style`-based colors, read
`useThemeScheme()` / `useThemeColors()`.

## Gotchas

- No dynamic class construction (`bg-${x}`) — use complete strings.
- `flex={1}` → `flex-1`; `items="center"` → `items-center`; `justify="between"` →
  `justify-between`.
- `numberOfLines` is a valid RN `Text` prop — keep it.
- Keep `global.css`, `tailwind.config.js`, and `constants/palette.ts` in sync when
  changing a token value (palette is the single source of truth).
