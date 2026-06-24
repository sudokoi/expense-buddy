---
"expense-buddy": minor
---

Port UI improvements from development branch

- **MMKV storage**: Replace AsyncStorage with react-native-mmkv for faster local persistence. One-time migration from AsyncStorage on first launch. Graceful fallback to AsyncStorage in Expo Go or when MMKV is unavailable.
- **IconActionButton**: New reusable chromeless icon button with long-press tooltip support. Applied across ExpenseRow actions, CategoryListItem actions, PaymentInstrumentsSection actions, sheet close buttons, day navigation, and search clear.
- **MarkdownText**: New lightweight markdown renderer for changelog display. Handles headings, bullet lists, links, inline code, and bold text.
- **Tab logging**: Added UI_ACTION log events on tab press for all 5 navigation tabs.
- **Translations**: Added `common.back`, `common.clearSearch`, `dayView.previousDay`, and `dayView.nextDay` keys across all 5 locales.
