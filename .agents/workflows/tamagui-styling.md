---
description: Tamagui styling conventions and theme color usage
---

# Tamagui Styling Guidelines

This document defines the styling conventions for using Tamagui in this project.

## Color Rules

**Never use hardcoded colors in components.** Always use one of these approaches:

1. Tamagui theme tokens (e.g., `$color`, `$background`, `$borderColor`)
2. Theme color constants from `constants/theme-colors.ts`
3. Helper functions like `getNotificationColor()`, `getChartColors()`, `getOverlayColors()`

```tsx
// ❌ BAD - hardcoded colors
const bgColor = isDark ? "#3A2F4D" : "#FFD1DC"
<View bg="#FFB6C1">

// ✅ GOOD - theme tokens
<View bg="$background">
<Text color="$color">

// ✅ GOOD - theme color constants
import { SEMANTIC_COLORS, ACCENT_COLORS } from "@/constants/theme-colors"
<View bg={SEMANTIC_COLORS.success}>
```

### Available Theme Color Constants

Located in `constants/theme-colors.ts`:

- `SEMANTIC_COLORS` - success, error, warning, info
- `FINANCIAL_COLORS` - expense, income colors
- `ACCENT_COLORS` - primary, secondary, tertiary
- `CHART_COLORS` - light/dark mode chart colors
- `OVERLAY_COLORS` - tooltip/overlay backgrounds
- `CARD_COLORS` - statistics card colors

### Helper Functions

```tsx
import {
  getNotificationColor,
  getChartColors,
  getOverlayColors,
} from "@/constants/theme-colors"

// Get notification color by type
const color = getNotificationColor("success") // Returns SEMANTIC_COLORS.success

// Get colors based on color scheme
const chartColors = getChartColors(isDark ? "dark" : "light")
const overlayColors = getOverlayColors(isDark ? "dark" : "light")
```

## Styling Priority

Always prefer Tamagui's built-in styling props over React Native's `style` prop. Only fall back to inline `style` props when Tamagui props don't work.

**Priority order:**

1. Tamagui component props (e.g., `padding`, `gap`, `bg`)
2. Tamagui shorthand props (e.g., `p`, `m`, `br`)
3. React Native `style` prop with `ViewStyle` (last resort)

## Working Tamagui Props

These props work directly on Tamagui components:

```tsx
// Layout & Spacing
<YStack gap="$4" padding="$3" margin="$2">
<Card bordered padding="$4" borderRadius="$4">

// Colors & Backgrounds
<View bg="$background" borderColor="$borderColor">
<Text color="$color" opacity={0.7}>

// Sizing
<Button flex={1} size="$4">
<Input size="$4" borderWidth={2}>
```

## Props That Require `style` Fallback

Some layout props don't work directly on Tamagui components and need the `style` prop:

```tsx
// These need ViewStyle
const styles = {
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  } as ViewStyle,
}

<XStack style={styles.container}>
```

## Theme Colors

Use Tamagui theme tokens for colors:

```tsx
// Good - uses theme tokens
<Text color="$color">
<View bg="$background">
<Card borderColor="$borderColor">

// For dynamic colors, use useTheme + getColorValue
const theme = useTheme()
const bgColor = getColorValue(theme.backgroundFocus)
```

## Component Patterns

### Cards with Sections

```tsx
<Card bordered padding="$4" borderRadius="$4">
  <SectionHeader>Title</SectionHeader>
  <YStack gap="$3">{/* content */}</YStack>
</Card>
```

### Pressable with Tamagui Styling

When combining React Native's `Pressable` with Tamagui components:

```tsx
<Pressable
  onPress={handlePress}
  style={({ pressed }) => [styles.pressable, { opacity: pressed ? 0.8 : 1 }]}
>
  <View bg={isSelected ? "$backgroundFocus" : "transparent"}>
    <Text color="$color">{label}</Text>
  </View>
</Pressable>
```

### Icons from @tamagui/lucide-icons

```tsx
import { Sun, Moon, Check } from "@tamagui/lucide-icons"

// Use with theme colors
const theme = useTheme()
<Sun size={18} color={getColorValue(theme.color)} opacity={0.7} />

// Or with string tokens (may have type issues)
<Check size={16} color="$color" />
```

## Common Issues

### TypeScript Errors with Props

If you get "Property does not exist" errors:

1. First try the full property name instead of shorthand
2. If that fails, use the `style` prop with `ViewStyle`
3. For colors, use `useTheme()` + `getColorValue()` helper

### Shorthand Props Reference

| Full Name       | Shorthand |
| --------------- | --------- |
| padding         | p         |
| paddingVertical | py        |
| margin          | m         |
| borderRadius    | br        |
| background      | bg        |
| borderColor     | bc        |

Note: Not all shorthands work on all components. Test and fall back to full names or `style` prop if needed.
