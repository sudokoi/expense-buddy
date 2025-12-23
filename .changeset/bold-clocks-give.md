---
"expense-buddy": patch
---

Add reusable UI components, fix theming issues, and remove type casts

### Theming & Styling Improvements

- Add reusable UI components (`AmountText`, `CategoryCard`, `CategoryIcon`, `ExpenseCard`, `ScreenContainer`, `SectionHeader`) for consistent styling
- Replace inline styles with Tamagui token-based styling across all screens
- Add `getColorValue()` helper for type-safe theme color extraction
- Fix white background issue in add expense screen

### Bug Fixes

- Fix back button behavior to close dialogs instead of navigating away
- Remove all `as any` type casts for better type safety

### Dependencies

- Bump Tamagui dependencies to latest versions
