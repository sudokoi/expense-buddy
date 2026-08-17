---
"expense-buddy": major
---

Migrated from Tamagui to NativeWind with Expo SDK 57 upgrade, kawaii UI redesign, and comprehensive codebase hardening.

**Breaking changes:**

- Removed Tamagui — all UI now uses NativeWind + native React Native primitives
- Icons migrated from `@tamagui/lucide-icons-2` to `lucide-react-native`
- `@react-navigation/native` removed — use `expo-router/react-navigation` instead
- Minimum Expo SDK 57, React Native 0.86, React 19.2

**UI redesign:**

- Borderless cards in light mode, subtle borders in dark mode
- Softer border-radius scale (card 20px, control 12px, chip 14px)
- Shadowless design across all surfaces
- Increased screen-edge spacing (16px → 20px)
- Standardized press feedback (active:opacity-60)
- Theme-aware statistics card colors and chart fills for dark mode
- Consolidated palette tokens (removed redundant THEME_COLORS)

**Quality improvements:**

- Accessibility labels on ~25 interactive elements
- Stricter TypeScript (noImplicitAny, noImplicitReturns, noUnusedLocals, noUnusedParameters)
- Stricter ESLint (no-explicit-any warn, no-console warn)
- All `as any` casts replaced with proper types
- StyleSheet/plain objects converted to NativeWind className
- Test-only exports removed from production barrels
- Config plugin for Gradle `failOnNoDiscoveredTests`

**Infrastructure:**

- Google Play submit track changed to alpha
- Prerelease changeset mode active
- Submit split into retriable job in CI workflows
- GitHub Actions updated to latest versions
