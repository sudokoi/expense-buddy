---
"expense-buddy": patch
---

Eliminate system-theme flash on launch when app theme differs from OS theme

- Keep splash visible until fonts and persisted theme are resolved and NativeWind is synced (`AppSplashGate` in `app/_layout.tsx`)
- Seed `settingsStore` synchronously from MMKV via `loadSettingsSync` / `getItemSync` so first paint already uses the user's light/dark preference
- Apply `setColorScheme` in `useLayoutEffect` in `ThemedProvider` to avoid one-frame flash
