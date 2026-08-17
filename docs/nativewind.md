# NativeWind

A reference for the styling stack used in this project. NativeWind lets us write
[Tailwind CSS](https://v3.tailwindcss.com) utility classes (`className`) on React Native
primitives, compiled to native `StyleSheet` objects at build time.

> Project-specific conventions live in:
> - [Styling & Theming Guide](./nativewind-conversion-guide.md) — tokens, mappings, components.
> - [`.agents/workflows/nativewind-styling.md`](./.agents/workflows/nativewind-styling.md) — agent styling rules.
>
> This document is distilled from the official NativeWind documentation.

## Overview

NativeWind styles components with Tailwind CSS and works on every React Native platform,
using the best engine for each: `StyleSheet.create` on native, CSS `StyleSheet` on web. On
native it does two things:

1. **Build time** — compiles Tailwind classes into `StyleSheet.create` objects and resolves
   conditional logic (hover/focus/active, dark mode, etc.).
2. **Runtime** — an efficient system applies the compiled styles to components.

On web it is a small polyfill that adds `className` support to React Native Web. There is no
runtime CSS-in-JS overhead and no custom wrappers — it works via a JSX transform, so it works
with third-party components too.

Key features: universal styling, media/container queries, custom values (CSS variables),
pseudo-classes (`hover`/`focus`/`active`), parent-state styles (`group`), dark mode, arbitrary
values, and platform selectors.

### How this differs from `StyleSheet.create`

React Native's `StyleSheet` only provides static styles. NativeWind adds UI-state styles,
responsive/device-state styles, and uses the best rendering engine — so you write the system
instead of building a custom one.

## Project setup (this repo)

Dependencies: `nativewind` (4.2.6), `tailwindcss` (3.4), `tailwindcss-animate`,
`react-native-css-interop` (peer), `react-native-reanimated`, `react-native-safe-area-context`.

**`babel.config.js`** — set the JSX import source and add the babel preset:

```js
module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],
  }
}
```

**`metro.config.js`** — wrap the config with `withNativeWind` and point it at `global.css`:

```js
const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const config = getDefaultConfig(__dirname)
config.resolver.sourceExts.push("mjs")

module.exports = withNativeWind(config, {
  input: "./global.css",
  inlineRem: 16,
})
```

**`tailwind.config.js`** — uses the NativeWind preset, `darkMode: "class"`, maps Tailwind
color/radius tokens to CSS variables, and adds the `tailwindcss-animate` plugin:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./providers/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        muted: "var(--muted)",
        foreground: "var(--foreground)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        expense: "var(--expense)",
        income: "var(--income)",
        success: "var(--success)",
        error: "var(--error)",
        warning: "var(--warning)",
        info: "var(--info)",
        // …kawaii decorative colors
      },
      borderRadius: {
        control: "8px",
        chip: "12px",
        card: "16px",
        round: "999px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

**`global.css`** — Tailwind directives plus the CSS variables. `:root` is light mode and
`.dark:root` is dark mode:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: #FFF8F0;
    --foreground: #4A4458;
    --accent: #C0406A;
    --accent-foreground: #FFFFFF;
    /* …see global.css for the full token set */
  }
  .dark:root {
    --background: #1A1625;
    --foreground: #F0E6F6;
    --accent: #FFB6C1;
    --accent-foreground: #1A1625;
  }
}
```

**`nativewind-env.d.ts`** — enables the TypeScript `className` types:

```ts
/// <reference types="nativewind/types" />
```

The app entry imports the CSS once (`import "./global.css"`).

> **Single source of truth:** the values in `global.css` and `tailwind.config.js` must stay in
> sync with `constants/palette.ts`. Change `palette.ts` first, then mirror into `global.css`.

## Theming & dark mode

NativeWind supports two dark-mode strategies via the `colorScheme` from `nativewind`:

- **System preference (automatic)** — follows the device. Recommended for most apps.
- **Manual toggle** — `colorScheme.set("light" | "dark" | "system")`.

This project uses **`darkMode: "class"`** (required for `setColorScheme`/`toggleColorScheme`),
so the `.dark` class on the root swaps the CSS variables and every semantic class
(`bg-background`, `text-foreground`, `border-border`, …) updates automatically.

```tsx
import { useColorScheme } from "nativewind"

function ThemeToggle() {
  const { colorScheme, setColorScheme } = useColorScheme()
  return (
    <Pressable onPress={() => setColorScheme(colorScheme === "dark" ? "light" : "dark")}>
      <Text className={colorScheme === "dark" ? "text-white" : "text-black"}>Toggle</Text>
    </Pressable>
  )
}
```

This project additionally resolves the palette in JS for `style`-based colors:

```tsx
import { useThemeColors, useThemeScheme } from "@/hooks/use-theme-colors"

const colors = useThemeColors()      // palette[ colorScheme === "dark" ? "dark" : "light" ]
const scheme = useThemeScheme()       // "light" | "dark"
```

### Dynamic themes with CSS variables

`vars()` sets CSS variables from JavaScript, flowing down the tree like normal CSS variables:

```tsx
import { vars } from "nativewind"

function Themed({ brandColor }) {
  return (
    <View style={vars({ "--brand-color": brandColor })}>
      <Text className="text-[--brand-color]">Themed text</Text>
    </View>
  )
}
```

`useUnstableNativeVariable("--brand-color")` reads a resolved variable value back into JS
(reactive). Prefix is "unstable" — API may change.

## Authoring styles

- **Static, complete class strings only.** The compiler scans for full class names at build
  time; it cannot see variables. Never do `className={`bg-${color}`}` — it is purged.
  ```tsx
  // ❌
  <View className={`bg-${colorName}`} />
  // ✅
  <View className={colorName === "error" ? "bg-error" : "bg-surface"} />
  ```
- **Primitives:** `View`, `Text`, `Pressable` + `className`.
- **Numeric values without a utility** (dynamic numbers, animations): use `constants/ui-tokens.ts`
  (`UI_SPACE`, `UI_RADIUS`, `UI_OPACITY`, `UI_FONT_WEIGHT`, `UI_BORDER_WIDTH`, `UI_ICON_SIZE`)
  in the `style` prop.
- **`cn()`** (`utils/cn.ts` = `clsx` + `tailwind-merge`) merges conditional classes.
- **`cva`** (class-variance-authority) builds component variants — see `components/ui/Button.tsx`,
  `components/ui/Card.tsx`.
- **Inline styles merge** with `className`. Specificity (highest → lowest): important
  (`!class`) → inline & remapped (right-to-left) → className. Use `!` only to override
  cross-platform discrepancies.

## Custom components

For your own components you rarely need `cssInterop`/`remapProps` — just pass `className`
through and merge it:

```tsx
function MyComponent({ className }) {
  return <Text className={`text-black dark:text-white ${className}`} />
}

// variants via cva
const variantStyles = { default: "rounded", primary: "bg-accent text-accent-foreground" }
function Button({ variant, className, ...props }) {
  return <Text className={`${variantStyles[variant]} ${className}`} {...props} />
}
```

Recommended class-management libraries: `cva`, `clsx`, `tailwind-variants`, `tw-classed`.
Multiple style props (e.g. `textClassName`) are fine to thread through manually.

## Third-party components

A third-party component works with NativeWind only if it forwards `className` (or all props)
to a core RN component:

```tsx
// ❌ picks props — className never reaches a styled element
function ThirdParty({ style }) { return <View style={style} /> }
// ✅
function ThirdParty({ style, ...props }) { return <View style={style} {...props} /> }
```

If you cannot change the component, tag it with **`cssInterop`** so NativeWind resolves its
`className` into styles (has a performance cost):

```tsx
import { cssInterop } from "nativewind"
import { Svg, Circle } from "react-native-svg"

cssInterop(Svg, { className: { target: "style", nativeStyleToProp: { width: true, height: true } } })
cssInterop(Circle, {
  className: { target: "style", nativeStyleToProp: { fill: true, stroke: true, strokeWidth: true } },
})

<Svg className="h-1/2 w-1/2" viewBox="0 0 100 100">
  <Circle cx="50" cy="50" r="45" className="fill-green-500 stroke-blue-500 stroke-2" />
</Svg>
```

**`remapProps`** creates new `className` props for components with multiple style props:

```tsx
import { remapProps } from "nativewind"

remapProps(ThirdPartyButton, { buttonClass: "buttonStyle", labelClass: "labelStyle" })
<CustomizedButton buttonClass="bg-blue-500" labelClass="text-white" />
```

Mapping forms: `{ "new-prop": "existing-prop" }`, `{ prop: true }` (override), or
`{ className: { target: "style", nativeStyleToProp: { textAlign: true } } }`.

## States & pseudo-classes

| Modifier | RN event | Notes |
| --- | --- | --- |
| `hover:` | `onHoverIn` / `onHoverOut` | needs `onHoverIn` (Pressable, TextInput; not View/Text) |
| `active:` | `onPressIn` / `onPressOut` | |
| `focus:` | `onFocus` / `onBlur` | |
| `disabled:` | `disabled` prop | |
| `empty:` | no children | |

```tsx
<Pressable className="bg-blue-500 active:bg-blue-700">
  <Text className="text-white">Press Me</Text>
</Pressable>
```

**Parent state** via `group`:

```tsx
<Pressable className="group/card">
  <Text className="group-active/card:text-blue-700">Child reacts to parent state</Text>
</Pressable>
```

Data-attribute selectors use `dataSet`:
`className="[&[data-active]]:bg-green-500" {...{ dataSet: { active } }}`.

## Platform differences & quirks

- **Explicit styles:** React Native misbehaves with conditionally-applied styles. Always
  declare both states: `<Text className="text-black dark:text-white" />` not
  `<Text className="dark:text-white" />`. Especially important for transitions/animations.
- **dp vs px:** RN uses `dp`, web uses `px`; NativeWind treats them as equivalent. Use `px`
  units in theme values; it fixes them.
- **Flex:** RN defaults `flexDirection` to `column`, `flexShrink` to `0`, and `flex` takes a
  single number. Set `flex-direction` explicitly and use `flex-1`.
- **`rem` sizing:** NativeWind inlines `rem`; this project sets `inlineRem: 16` in metro. RN
  `<Text>` default is `14`, web `16`.
- **Platform modifiers:** `ios:`, `android:`, `web:`, `native:` (everything but web).
- **Colors don't cascade:** `<View className="text-red-500">` does **not** color child text.
  Put text color on the `<Text>`.

## Fonts

React Native has no `@font-face`/fallback stacks; each weight is a separate file and the
**file name must match the PostScript name** (or iOS silently falls back). Variable fonts do
not work — use static weights.

This project ships Inter (`.otf`) via the `expo-font` plugin in `app.json` and maps each
weight to a Tailwind class in `tailwind.config.js`:

```json
{ "expo": { "plugins": [["expo-font", { "fonts": ["./assets/fonts/Inter-Regular.otf", "./assets/fonts/Inter-Bold.otf"] }]] } }
```

```js
fontFamily: { inter: ["Inter-Regular"], "inter-bold": ["Inter-Bold"], "inter-semibold": ["Inter-SemiBold"] }
```

```tsx
<Text className="font-inter-semibold">Semibold</Text>
```

> `font-bold` sets `fontWeight`, not the font family — use `font-inter-bold` for the bold file.

## Animations & transitions

Powered by `react-native-reanimated`. `animate-*` and `transition-*` utilities are
**experimental**; `transition` works on re-render or pseudo-class changes. `transform-origin`
is not supported on native yet. Changing `animation-duration` mid-animation restarts it.

## Key APIs

### `withNativeWind(metroConfig, options)`
Metro wrapper. Options: `input` (required, path to CSS), `inlineRem` (number or `false`,
default `14`; this project uses `16`), `projectRoot`, `outputDir`, `configFile`,
`hotServerOptions`, and `experiments.inlineAnimations` (reanimated inline shared values).

### `useColorScheme()`
```ts
const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme()
```
`colorScheme` is the current scheme; `setColorScheme`/`toggleColorScheme` require
`darkMode: "class"` in `tailwind.config.js`.

### `StyleSheet` (from `nativewind` / `react-native-css-interop`)
Internal methods (`registerCompiled`, `getFlag`, `getGlobalStyle`) used by the build system.
The v2/v3 `NativeWindStyleSheet` API (`setOutput`, `setDimensions`, `setAppearance`) is gone
in v4 — use `useColorScheme()` for color scheme.

### `cssInterop(component, mapping)` / `remapProps(component, mapping)`
See [Third-party components](#third-party-components).

### `vars()` / `useUnstableNativeVariable()`
See [Theming & dark mode](#theming--dark-mode).

## Troubleshooting

- **Always reset the cache first:** `npx expo start --clear` (or `npx react-native start --reset-cache`).
- **Verify Tailwind compiles** the CSS:
  ```bash
  npx tailwindcss --input ./global.css --output output.css
  ```
  If a class is missing from `output.css`, the issue is Tailwind compilation, not NativeWind.
- **`verifyInstallation()`** — call it *inside* a component (not global scope) to confirm setup.
- **`DEBUG=nativewind npx expo start --clear`** — prints NativeWind debug info; useful when
  reporting issues (redirect to a file).
- **Colors not working?** A `<View>` does not accept/forward `color`; move color classes to
  the `<Text>`.
- **Modifiers not working?** Ensure the component supports both the style and the required
  event prop (e.g. `hover:text-white` needs `color` styling **and** `onHoverIn`).

## Further reading

- NativeWind docs: installation, theming, custom components, third-party components, Tailwind
  compatibility tables (most web utilities work; `grid`, `container` queries, and several
  `background-*`/`filter-*` utilities are web-only or unsupported on native).
- [Tailwind CSS documentation](https://tailwindcss.com/docs) for the utility language.
