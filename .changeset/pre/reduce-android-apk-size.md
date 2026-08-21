---
"expense-buddy": patch
---

Cut Android APK size (~136MB → ~70MB)

- Restrict native builds to `arm64-v8a` via `expo-build-properties` `buildArchs`; the previous `EAS_BUILD_ANDROID_ABIS` env var was not a supported setting, so every APK bundled x86, x86_64, and armeabi-v7a libs (~57MB) unnecessarily
- Enable R8 minification and resource shrinking for release builds (`enableMinifyInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`), shrinking the ~43MB of unminified dex
- Remove the ineffective `EAS_BUILD_ANDROID_ABIS` entry from the `internal` EAS profile
