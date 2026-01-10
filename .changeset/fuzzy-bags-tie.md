---
"expense-buddy": minor
---

Add in-app update notification system

- Automatic update check on app launch (once per session, skipped in DEV mode)
- Non-intrusive update banner with version info, Update and Dismiss buttons
- Dismissal persistence across sessions via AsyncStorage
- Smart URL handling: Play Store for Play Store installs, GitHub releases otherwise
- Manual update check from settings bypasses dismissal
- useUpdateCheck hook for centralized update state management

Fix dashboard chart Y-axis label truncation for large expense values (e.g., 27000 → 27K)
