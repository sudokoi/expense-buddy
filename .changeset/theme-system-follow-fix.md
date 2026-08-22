---
"expense-buddy": patch
---

Fix "System" theme not applying until app relaunch

- Forward the raw theme preference to NativeWind instead of resolving "system" in JS, so the OS owns system-theme tracking and the app follows live dark/light toggles
- Remove the store's duplicate `systemColorScheme` state, its Appearance listener, and the `selectEffectiveTheme` selector — resolved scheme now comes from NativeWind's `useColorScheme()`
- Simplify the splash gate now that ThemedProvider applies the preference in a layout effect before first paint
