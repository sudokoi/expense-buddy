---
"expense-buddy": patch
---

Remove unused web target and dead dependencies

- Drop the vestigial web target (`react-dom`, web config, `yarn web`, `@expo/metro-runtime`) and remove iOS platform config (`ios` section, `yarn ios` script) — this is an Android-only app
- Remove unused `expo-web-browser` dependency and its no-op plugin entry
- Move `@types/papaparse` to devDependencies; drop legacy `assetBundlePatterns`
