---
"expense-buddy": patch
---

Fix UI theming and safe area issues

- Add themed header styling to day view screen for consistent app bar appearance in light/dark modes
- Fix safe area insets for bottom navigation to prevent content overlap on devices with home indicators
- Update ScreenContainer, Add Expense, and History screens to use dynamic safe area padding
- Fix day view transaction text readability in dark mode by using theme-aware colors
