---
"expense-buddy": major
---

Migrated UI framework from Tamagui to NativeWind with Expo SDK 57 upgrade.

**Breaking changes:**

- Removed Tamagui — all UI now uses NativeWind + Tailwind CSS
- Icons migrated from `@tamagui/lucide-icons-2` to `lucide-react-native`
- Minimum Expo SDK 57, React Native 0.86, React 19.2

**New features:**

- Haptic feedback on save, delete, sync, and UI interactions
- Theme-aware statistics card colors and chart fills for dark mode
- Accessibility labels on interactive elements

**Improvements:**

- Softer, borderless card design in light mode
- Larger border-radius for a more approachable feel
- Shadowless surfaces for a cleaner look
- Increased screen-edge spacing
- Standardized press feedback across all interactive elements
- Improved SMS import parsing for SBI, Axis, and AMEX transactions
- i18n: all user-visible strings now translated
