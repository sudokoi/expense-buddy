---
"expense-buddy": patch
---

fix: Switch activeStyle for checked state (bg was silently overridden by $backgroundActive)

chore: replace all as ViewStyle/as TextStyle/as any casts with as const on style objects; remove 23 unused ViewStyle/TextStyle imports

refactor: inline 130+ style={layoutStyles.xxx} usages as direct Tamagui component props (items, justify, p, px, py, rounded, etc.) across 38 files; remove ~30 empty const style objects
