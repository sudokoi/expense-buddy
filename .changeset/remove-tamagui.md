---
"expense-buddy": major
---

Removed the Tamagui UI framework and migrated the entire app to native React Native primitives (View, Text, Pressable) styled with nativewind utility classes and the shared design-token modules. Icons now come from `lucide-react-native` instead of `@tamagui/lucide-icons-2`, and all Tamagui build tooling (babel/metro plugins, `tamagui.config.ts`, generated `.tamagui/`) has been dropped.

This is a breaking architectural change — Tamagui is no longer a dependency — but preserves existing screens, behavior, and visual design.
