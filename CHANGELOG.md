# expense-buddy

## 1.9.0

### Minor Changes

- [#23](https://github.com/sudokoi/expense-buddy/pull/23) [`05efbcb`](https://github.com/sudokoi/expense-buddy/commit/05efbcb6a093bec13f3e55ecb2a24500bee8cea7) Thanks [@sudokoi](https://github.com/sudokoi)! - **Refactored GitHub Sync Architecture with XState**
  - **Architecture**: Replaced TanStack Query with a robust XState v5 state machine `sync-machine.ts` for better sync orchestration and error handling.
  - **Performance**: Eliminated unnecessary remote data downloads when already in sync.
  - **Bug Fixes**:
    - Fixed false "conflict" detection when creating new expenses.
    - Resolved issue where identical remote files were reported as updates.
  - **UX**: Added user-friendly error messages for specific network and authentication failures (e.g., "No internet connection", "Rate limit exceeded").
  - **Cleanup**: Removed `@tanstack/react-query` dependency and ~200 lines of dead code (`autoSync`, `analyzeConflicts`).

## 1.8.1

### Patch Changes

- Refine GitHub Sync logic and UI:
  - Detailed sync feedback, robust server-side timestamp handling, improved settings layout, and usability fixes for configuration.

## 1.8.0

### Minor Changes

- [#21](https://github.com/sudokoi/expense-buddy/pull/21) [`8fd359d`](https://github.com/sudokoi/expense-buddy/commit/8fd359d3533a0067f049ebc3bb7d057481f2eede) Thanks [@sudokoi](https://github.com/sudokoi)! - Add "Rent" expense category and refactor sync logic

  ### Features
  - Add "Rent" expense category with Building icon and soft olive green color
  - Unify sync buttons into single intelligent "Sync" button with automatic push/pull detection
  - Reorder categories by usage frequency (Food → Transport → Groceries → Rent → ...)

  ### Refactoring
  - Migrate sync state management from xstate to TanStack Query mutations
  - Add `useSyncPush`, `useSyncPull`, `useSmartSync`, and `useSyncStatus` hooks
  - Remove `sync-status-store.ts` in favor of mutation-derived state

## 1.7.2

### Patch Changes

- fix(sync): improve 422 error handling and sanitize paths

## 1.7.1

### Patch Changes

- [`1678bcd`](https://github.com/sudokoi/expense-buddy/commit/1678bcd9e6a680981602a72c4a7da28bb28b5f0c) Thanks [@sudokoi](https://github.com/sudokoi)! - Fix "Other" input method in edit flow

## 1.7.0

### Minor Changes

- Refactor useEffect hooks and add "Other" payment method description
  - Removed unnecessary useEffect hooks by moving state management to xstate stores
  - Sync notifications now auto-route via store effects instead of component effects
  - Default payment method and expanded section state now load from store initialization
  - Settings screen reads sync config from store instead of loading via useEffect
  - Added optional description field for "Other" payment method (e.g., "Venmo", "PayPal")

## 1.6.3

### Patch Changes

- Notification system fixes and kawaii styling
  - Fix xstate event type collision by renaming 'type' to 'notificationType'
  - Move store initialization from module load to StoreProvider useEffect
    to prevent "window is not defined" error on native devices
  - Remove Tamagui toast system, consolidate to NotificationStack
  - Update NotificationStack with kawaii styling (rounded corners,
    colored shadows, icon backgrounds, dark text for contrast)

- Dismiss keyboard before form validation to fix double-tap issue
  - Add Keyboard.dismiss() to save handlers in settings, add expense, and
    edit expense flows to ensure button presses are captured on first tap
    when an input field is focused.

## 1.6.2

### Patch Changes

- Add payment method display, complete settings sync, Zod validation, and toast styling
  - Display payment method identifiers on expense cards (e.g., "Credit Card (1234)")
  - Add edit expense modal with payment method support
  - Extend AppSettings to include auto-sync configuration (v3 migration)
  - Add Zod validation for expense forms and GitHub configuration
  - Add type-specific toast notification colors (success, error, warning, info)
  - Include comprehensive property-based and unit tests

## 1.6.1

### Patch Changes

- Fix sync notifications and improve analytics time window options

  ### Bug Fixes
  - Fix toast notification missing background in dark mode by replacing undefined `theme="accent"` with explicit theme-aware styling
  - Fix sync button showing "1 record updated" when only settings changed by distinguishing between expense and settings changes in the label
  - Fix settings sync not clearing the change flag after successful upload
  - Fix sync down making duplicate network calls for settings

  ### Improvements
  - Add "All" time window option in Analytics to view all downloaded expenses, not just last 7/15/30 days
  - Improve sync button text to show descriptive labels like "2 expense(s) + settings changed" instead of generic "X record(s) changed"
  - Settings label in sync button only appears when settings sync is enabled AND settings have actually changed
  - Optimize sync handlers by removing redundant async/await calls
  - Add `hasChangesToSync` memoized value for more accurate sync button disabled state

## 1.6.0

### Minor Changes

- Migrate to XState Store and improve rendering performance

  ### State Management Migration
  - Replace React Context + useState with XState Store v3 for all application state
  - Create 4 dedicated stores: expense-store, settings-store, notification-store, sync-status-store
  - Add custom hooks (useExpenses, useSettings, useNotifications, useSyncStatus) for store access
  - Delete old context files (ExpenseContext, SettingsContext, notification-context, sync-status-context)

  ### Performance Optimizations
  - Remove all animations from UI components for improved performance
  - Wrap ExpenseCard, CollapsibleSection, ScreenContainer with React.memo
  - Create memoized list item components (ExpenseListItem, RecentExpenseItem, DayExpenseItem)
  - Memoize event handlers with useCallback across all screens
  - Memoize computed values with useMemo (totalExpenses, chartData, groupedExpenses)
  - Extract static theme colors and layout styles outside components

  ### UI Fixes
  - Fix auto-sync helper text spacing
  - Set GitHub config accordion to collapsed by default
  - Disable sync button when no pending changes

  ### Testing
  - Add 52 unit tests for all 4 stores
  - Add 11 property-based tests validating store correctness
  - Add fast-check dependency for property-based testing

## 1.5.3

### Patch Changes

- [`9809010`](https://github.com/sudokoi/expense-buddy/commit/98090107731ad603ea5732221c925005c1916c6c) Thanks [@sudokoi](https://github.com/sudokoi)! - Optimize category and payment method selection responsiveness
  - Replace slow "bouncy" animations with "quick" across selection components
  - Memoize CategoryCard and PaymentMethodCard to prevent unnecessary re-renders
  - Add useCallback for selection handlers in add/edit flows
  - Remove unnecessary animations from static display cards

## 1.5.2

### Patch Changes

- [`f2cf2db`](https://github.com/sudokoi/expense-buddy/commit/f2cf2db05027d9688c0bff631a0f1e36d9e97e16) Thanks [@sudokoi](https://github.com/sudokoi)! - Add payment method tracking with analytics pie chart, default payment method selection in settings, and improved expense categorization by payment type

## 1.5.1

### Patch Changes

- Add settings sync with GitHub and redesigned settings screen
  - Redesigned settings screen with organized sections (Appearance, GitHub Sync, Auto-Sync, App Information)
  - Added theme selector with Light, Dark, and System Default options
  - Settings now sync to GitHub alongside expenses when enabled
  - Added "Also sync settings" toggle to control settings sync behavior
  - Settings changes reflected in sync button badge count

## 1.5.0

### Minor Changes

- Complete kawaii theme implementation with UI consistency improvements
  - Apply kawaii theme colors across entire app (tab bar, settings, add screen, modal)
  - Centralize theme colors in `constants/theme-colors.ts` (semantic, financial, accent, chart, card colors)
  - Create single source of truth for category colors in `constants/category-colors.ts`
  - Update statistics cards to use kawaii pastel colors
  - Fix padding/margin inconsistencies across screens (standardize to 16px)
  - Fix expense card spacing consistency between dashboard and history
  - Add auto-shrink font for long category names in analytics cards

## 1.4.4

### Patch Changes

- UI standardization and improvements:
  - Fixed TypeScript errors by using `bg` prop instead of `backgroundColor` for Tamagui components
  - Standardized safe area padding to `8 + insets.bottom` for cleaner spacing
  - Fixed edit transaction modal extending outside safe area with `maxHeight="80%"`
  - Replaced category dropdown with compact category buttons in edit expense modal
  - Made category cards more compact to fit all content without scrolling
  - Fixed Expo Go compatibility by using dynamic import for react-native-device-info
  - Removed large amount preview text from add expense screen
  - Standardized action button sizes to `$4` across all screens for consistency

## 1.4.3

### Patch Changes

- Add alpha track submission to release workflows
  - Submit production AAB to both internal and alpha tracks
  - Add alpha submit profile to eas.json

## 1.4.2

### Patch Changes

- Add smart update checker with Play Store detection
  - Check for Updates now detects install source: Play Store installs open the store page directly, sideloaded installs check GitHub releases
  - Added Google Play Store badge and link to README
  - CI workflows now auto-submit production builds to Play Store (with continue-on-error)
  - Added react-native-device-info for install source detection

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
