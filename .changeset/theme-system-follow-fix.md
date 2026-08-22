---
"expense-buddy": patch
---

Fix "System" theme not applying until app relaunch

- Forward the raw theme preference to NativeWind instead of resolving "system" in JS, so the OS owns system-theme tracking and the app follows live dark/light toggles
- Remove the store's duplicate `systemColorScheme` state, its Appearance listener, and the `selectEffectiveTheme` selector — resolved scheme now comes from NativeWind's `useColorScheme()`
- Hold the splash until a forced light/dark preference is visible in NativeWind's resolved scheme (the native override lands asynchronously), preventing an OS-theme flash on launch
