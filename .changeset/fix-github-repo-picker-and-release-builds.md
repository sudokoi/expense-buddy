---
"expense-buddy": patch
---

Fix GitHub repo picker selection not reaching settings

- Re-read the repo/branch draft from secure storage on screen focus (`useFocusEffect`), so a repository chosen in the picker updates the field after returning instead of staying stale
- Drop dead web-only token-entry paths and Platform guards now that the app is Android-only
- Disable R8 minification and resource shrinking in release builds again, reverting the size optimization while keeping the `arm64-v8a`-only arch config
