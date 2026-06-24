---
"expense-buddy": minor
---

Port UI improvements from development branch

- **MMKV storage**: Replace AsyncStorage with react-native-mmkv for faster local persistence. One-time migration from AsyncStorage on first launch. Graceful fallback to AsyncStorage in Expo Go or when MMKV is unavailable.
- **IconActionButton**: New reusable chromeless icon button with long-press tooltip support. Applied across ExpenseRow actions, CategoryListItem actions, PaymentInstrumentsSection actions, sheet close buttons, day navigation, and search clear.
- **Changelog rendering**: Render release notes with `react-native-markdown-display` for full markdown support (headings, ordered/unordered lists, fenced and inline code, links, blockquotes, and horizontal rules).
- **Input placeholder contrast**: Set `placeholderTextColor` on all text inputs (add/edit expense, filters, category and payment forms, SMS review, GitHub config, repo picker) so placeholders remain legible in all themes.
- **Native logging**: Added Android logging to the Play Core, SMS parser, and ML classifier native modules for better diagnostics.
- **Play Store update resilience**: Guard native Play Core calls so update checks and status subscriptions degrade gracefully when the module is unavailable (e.g. Expo Go, iOS).
- **Category color hook**: Extracted category color resolution into a shared `useResolvedCategoryColor` hook used by CategoryCard and CategoryListItem.
- **Tab logging**: Log navigation changes via `usePathname` (`NAV / TAB_CHANGE route=…`), covering programmatic navigation in addition to tab presses.
- **Translations**: Added `common.back`, `common.clearSearch`, `dayView.previousDay`, and `dayView.nextDay` keys across all 5 locales.
