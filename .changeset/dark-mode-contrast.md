---
"expense-buddy": patch
---

Fix dark-mode contrast, tab alignment, and UI spacing inconsistencies

- Fix black labels and unreadable chips in dark mode with theme-aware colors
- Center tab bar icons horizontally
- Consolidate filter chip styling into Button component, remove per-button overrides
- Add consistent gap between analytics chart cards
- Align history screen padding and SettingsSection gap tokens with UI_SPACE values
- Use theme.muted for unselected CategoryCard, PaymentMethodCard, and payment instrument items
- History filter chips now open filter screen (matching analytics behavior)
- Brighten dark-mode muted color from #362D40 to #4A3D52
- Remove per-item text color overrides from CategoryFilter and PaymentMethodFilter
