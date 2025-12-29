# expense-buddy

## 1.4.1

### Patch Changes

- Derive Android versionCode and iOS buildNumber from package.json version
  - Replace static `app.json` with dynamic `app.config.js`
  - Auto-calculate versionCode using formula: `MAJOR * 10000 + MINOR * 100 + PATCH`
  - Single source of truth for versioning (package.json)
  - Remove `sync-app-version.mjs` script (no longer needed)
  - Change `appVersionSource` from "remote" to "local" in eas.json

## 1.4.0

### Minor Changes

- [#13](https://github.com/sudokoi/expense-buddy/pull/13) [`9cf1641`](https://github.com/sudokoi/expense-buddy/commit/9cf164182fd97362b53a60f1e522dedb23e5d6e4) Thanks [@sudokoi](https://github.com/sudokoi)! - Add Analytics tab with expense insights and UI improvements

  Analytics Features:
  - New Analytics tab with pie chart (category breakdown) and line chart (daily spending)
  - Time window selector (7 days, 15 days, 1 month)
  - Category filter for focused analysis
  - Statistics cards showing total spent, daily average, top category, and peak day
  - Collapsible chart sections

  Navigation & UI:
  - Icon-only tab bar with Analytics (PieChart) icon
  - "View Analytics" link on dashboard chart section
  - Green auto-sync toggle with improved dark mode contrast

## 1.3.4

### Patch Changes

- [`a3b28e4`](https://github.com/sudokoi/expense-buddy/commit/a3b28e43d65902f8f1c42fadd6c6c58b702cd6c3) Thanks [@sudokoi](https://github.com/sudokoi)! - Fix UI theming and safe area issues
  - Add themed header styling to day view screen for consistent app bar appearance in light/dark modes
  - Fix safe area insets for bottom navigation to prevent content overlap on devices with home indicators
  - Update ScreenContainer, Add Expense, and History screens to use dynamic safe area padding
  - Fix day view transaction text readability in dark mode by using theme-aware colors

## 1.3.3

### Patch Changes

- [`acebb96`](https://github.com/sudokoi/expense-buddy/commit/acebb96e5cb9a8689fcd75d64d254436d995fa67) Thanks [@sudokoi](https://github.com/sudokoi)! - Resolve white background issue on Android native and improve text consistency
  - Fix background color not applying on Android by using `backgroundColor` prop instead of `background` shorthand in Add Expense and History screens
  - Add `contentStyle` with theme background to root Stack.Screen for tabs navigation
  - Standardize empty state text opacity across screens for consistent light/dark mode visibility
  - Update empty state message to reference "Add Expense tab" instead of "+ tab"

## 1.3.2

### Patch Changes

- [`6ff0a31`](https://github.com/sudokoi/expense-buddy/commit/6ff0a31fadd6e4bd03a318964c06a19508d728dd) Thanks [@sudokoi](https://github.com/sudokoi)! - UI Legibility and Theme Enhancements
  - _Dynamic Theming_: Fixed Add and History tabs to correctly switch backgrounds between light and dark modes.
  - _Improved Contrast_: Replaced hardcoded grays with themed tokens and opacities for better subtext legibility across the app.
  - _Button Visibility_: Fixed "Load More" and "Save" button visibility in light mode using theme inversion.
  - _Settings UI_: Refined spacing for auto-sync descriptions and improved the visibility of app version information.
  - _Code Cleanup_: Removed unused color constants and resolved Tamagui-related TypeScript linting errors.

## 1.3.1

### Patch Changes

- [`c8a66dd`](https://github.com/sudokoi/expense-buddy/commit/c8a66dd6677fc8af79114519b366111211becf8c) Thanks [@sudokoi](https://github.com/sudokoi)! - Add reusable UI components, fix theming issues, and remove type casts

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

## 1.3.0

### Minor Changes

- [`648ef34`](https://github.com/sudokoi/expense-buddy/commit/648ef34f00f0bdbb5a97bda769df3518690259bc) Thanks [@sudokoi](https://github.com/sudokoi)!

  ### Features
  - Add arithmetic expression support in expense entry (e.g., `10+5*2`)
  - Add expression parser utility with property-based tests
  - Add ESLint 9 and Prettier for linting and formatting

  ### CI/CD
  - Add PR workflow for lint, format, and test
  - Automate changelog and release flow with changesets action

## 1.2.1

### Patch Changes

- Github sync now batches all file changes into a single commit instead of creating separate commits per file

## 1.2.0

### Minor Changes

- Added "Groceries" category with shopping cart icon to distinguish grocery shopping from dining expenses
- Implemented differential sync - only uploads changed files to GitHub, reducing API calls and improving sync performance
- Fixed dashboard graph not updating in real-time when expenses are added, edited, or deleted
- Sync button now shows accurate count of changed files instead of total expenses
- Added date picker to expense edit flow - you can now change the date when editing an expense

## 1.1.2

### Patch Changes

- Inputs (especially the note field) were getting hidden behind the keyboard when focused.

  **Changes:**
  - Added `react-native-keyboard-controller` with `KeyboardProvider` in app layout
  - Replaced ScrollView with `KeyboardAwareScrollView` in add expense and edit dialog screens

## 1.1.1

### Patch Changes

- rename package name

## 1.1.0

### Minor Changes

- - Display transaction notes as primary text with category in subtext
  - Add in-app update checker that fetches latest release from GitHub
  - Show current version and download link when updates are available

## 1.0.0

### Initial Release

- Expense tracking with categories
- CSV export functionality
- GitHub sync integration
- Monthly and category-based analytics
- Dark mode support
