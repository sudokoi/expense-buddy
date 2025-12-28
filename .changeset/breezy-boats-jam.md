---
"expense-buddy": patch
---

Resolve white background issue on Android native and improve text consistency

- Fix background color not applying on Android by using `backgroundColor` prop instead of `background` shorthand in Add Expense and History screens
- Add `contentStyle` with theme background to root Stack.Screen for tabs navigation
- Standardize empty state text opacity across screens for consistent light/dark mode visibility
- Update empty state message to reference "Add Expense tab" instead of "+ tab"
