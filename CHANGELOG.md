# expense-buddy

## 2.2.0

### Minor Changes

- Implement full app internationalization (i18n)
  - Add support for English (US, UK, IN), Japanese and Hindi locales
  - Configure i18next with persistent language preference
  - Localize all major screens: Dashboard, History, Add Expense, Analytics, Settings
  - Add Language and Currency selectors in Settings
  - Update currency formatting to adhere to locale (legacy fallback to INR)
  - Update date formatting to use localized strings
  - Implement **Multi-Currency Support** in Dashboard and Analytics
    - Expenses are grouped by currency, allowing correct aggregation without mixing currencies
    - Added currency filter chips to Dashboard and Analytics screens when multiple currencies are present
    - Updated specific charts (Total Spent, Daily Trend, Statistics) to reflect the selected currency
    - Amount input in Add/Edit screens explicitly shows the active currency symbol
    - Charts and statistics automatically default to the most relevant currency
  - **Dynamic Locale Loading**: Only the active locale is bundled at startup (~60KB bundle size reduction), with other locales loaded on-demand when selected

### Patch Changes

- Major architecture improvements and code quality enhancements:
  - **State Management Refactoring**
    - Extracted UI state (section expansion states) into dedicated `ui-state-store.ts` for device-specific preferences
    - Added `createSettingUpdater()` factory function to eliminate ~120 lines of repetitive boilerplate in settings store
    - Reduced settings store complexity while maintaining full functionality
  - **Analytics System Refactoring**
    - Split `useAnalyticsData` hook (240 lines) into 3 focused hooks: `useAnalyticsBase`, `useAnalyticsCharts`, `useAnalyticsStatistics`
    - Split `analytics-calculations.ts` (579 lines) into 5 domain-specific modules: time utilities, filters, currency grouping, aggregations, and statistics
    - Each module now has clear single responsibility and is independently testable
  - **Developer Experience Improvements**
    - Added barrel exports (`index.ts`) to `hooks/`, `services/`, and `utils/` directories for cleaner imports
    - Consolidated duplicate `DateRange` type definitions into shared `types/analytics.ts`
    - Created `test-utils/` module with factory functions for creating mock expenses, categories, and settings
    - Improved code organization and maintainability
  - **Bug Fixes**
    - Fixed duplicate `selectedPaymentInstruments` prop in analytics screen
    - Fixed keyboard type regression in history edit (reverted to `default` to support expression input)
    - Fixed layer violation: moved `PaymentMethodSelectionKey` import from components to utils
    - Fixed TypeScript errors in test files after adding new interfaces
  - **Persistence Improvements**
    - Added `selectedCurrency` to analytics filters persistence (now survives app restarts)
    - Removed duplicate i18n storage (now solely managed by settings store)
  - **Testing**
    - Added comprehensive tests for `computeEffectiveCurrency` utility covering all edge cases
    - All 572 tests passing, no breaking changes
    - Full backward compatibility maintained

## 2.1.4

### Patch Changes

- Fix local day grouping across the app
  - Added a shared local day key helper in `date.ts` and used it for grouping/filtering in history, day view, dashboard, analytics, and daily file logic
  - Updated property/unit tests to use the local day helper and added boundary checks for midnight/day transitions in date.test.ts and daily-file-manager.test.ts
  - Aligned date generation in sync-related tests to avoid UTC day shifts.

## 2.1.3

### Patch Changes

- Fix chevrons; add notifications
  - Fixed chevron icons in various settings sections to correctly indicate expanded/collapsed state
  - Added user notifications for added and edited expenses

## 2.1.2

### Patch Changes

- Add "Add another" button to expense form; persist analytics filter settings
  - Added “Add another” button next to “Save Expense”; refactored save handler to support save+reset (stay) vs save+navigate; validation blocks both actions on errors
  - New device-local AsyncStorage persistence for analytics filters (defaults + normalization)

## 2.1.1

### Patch Changes

- [`097c998`](https://github.com/sudokoi/expense-buddy/commit/097c998e9c74cbacda85cb245564522f9564a6e9) Thanks [@sudokoi](https://github.com/sudokoi)! - Settings UI and changelog improvements.
  - Changelog work:
    “What’s New” now pulls the installed version’s entry from CHANGELOG.md (no asset-download boilerplate) and safely skips showing if the changelog is missing/malformed or the version section isn’t found.
  - Settings UI improvement:
    - Default payment method section is now collapsible.
    - Reorder theme configuration

## 2.1.0

### Minor Changes

- Added features and improvements:
  - Analytics: move filters into a dedicated sheet with an explicit Apply action (improves UX and reduces accidental filter changes).
  - Payments/Analytics: add Amazon Pay as a payment method and extend analytics time windows to 3 months / 6 months / 1 year.

## 2.0.0

### Major Changes

- [#33](https://github.com/sudokoi/expense-buddy/pull/33) [`97fb0cd`](https://github.com/sudokoi/expense-buddy/commit/97fb0cde9fb3c362dc7cabd1d124509d5bf3ca9d) Thanks [@sudokoi](https://github.com/sudokoi)! - BREAKING: Native GitHub sync setup now uses GitHub OAuth Device Flow ("Sign in with GitHub") instead of manually entering a Personal Access Token.
  - Android/iOS: sign in via GitHub, then pick a repository (personal repos only; requires write access)
  - During sign-in, the app shows a device code with actions to copy the code and open the GitHub verification page in your browser
  - Web: still uses manual Personal Access Token entry (unchanged)

  If you previously configured sync on native using a PAT, you may need to sign in again and re-select your repo/branch.

## 1.12.2

### Patch Changes

- Show “What’s New” changelog after app updates
  - Adds a one-time changelog Sheet that appears on first launch after updating, pulling release notes for the currently installed version from GitHub Releases.
  - Skips showing the changelog when release notes are empty/whitespace, in dev mode, or when a newer update is already available (update CTA takes priority).
  - Adds “View full release notes” action and persists the last-seen version locally so the changelog only shows once per version.
  - Includes property-based tests for changelog gating logic.

## 1.12.1

### Patch Changes

- Refactored theme management and improved system UI readability
  - Removed hardcoded UI color literals across the app by centralizing theme colors/tokens and adding a contrast helper so text/icons remain readable in light/dark mode; updated category fallbacks, shadows, and web background behavior; tests stayed green
  - Improved system UI readability by making the StatusBar follow the app’s effective theme (so time/notification icons are visible in light mode); typecheck + full test suite pass

## 1.12.0

### Minor Changes

- [#31](https://github.com/sudokoi/expense-buddy/pull/31) [`3726f95`](https://github.com/sudokoi/expense-buddy/commit/3726f952b9b4fe34878226494febe70db95dafa9) Thanks [@sudokoi](https://github.com/sudokoi)! - Add payment instrument management, analytics integration, and GitHub sync support.
  - Adds saved payment instruments (Credit/Debit cards + UPI) with nicknames and digit-masking support, including validation/utilities and startup migration that backfills instruments + links existing expenses while keeping expense CSV backward compatible.
  - Updates expense entry/edit flows to select a saved instrument (or “Others” manual digits) via a new inline dropdown, plus a settings screen section to add/edit/remove instruments.
  - Expands analytics to support full payment-method filter chips and dependent instrument chips, including instrument-level breakdown sections and tappable pie chart flows.
  - Extends GitHub sync to optionally sync settings.json (when enabled), hydrate merged settings on sync-down, and include payment instruments in settings merges; auto-sync surfaces downloaded settings.
  - Adds comprehensive non-UI test coverage for payment instrument merging, settings hydration, and migration/linking behavior; removes stray test output artifacts.

## 1.11.0

### Minor Changes

- [`1991858`](https://github.com/sudokoi/expense-buddy/commit/199185875b433f21875cffc22c0477db59d45f08) Thanks [@sudokoi](https://github.com/sudokoi)! - Add in-app update notification system
  - Automatic update check on app launch (once per session, skipped in DEV mode)
  - Non-intrusive update banner with version info, Update and Dismiss buttons
  - Dismissal persistence across sessions via AsyncStorage
  - Smart URL handling: Play Store for Play Store installs, GitHub releases otherwise
  - Manual update check from settings bypasses dismissal
  - useUpdateCheck hook for centralized update state management

  Fix dashboard chart Y-axis label truncation for large expense values (e.g., 27000 → 27K)

## 1.10.2

### Patch Changes

- Add issue templates and Report an Issue button
  - Add GitHub issue templates for bug reports and feature requests
  - Add "Report an Issue" button in settings above "View on GitHub"
  - Configure issue template chooser to guide users to appropriate forms

## 1.10.1

### Patch Changes

- refactor: modularize settings UI and enhance service layer
  - Extract settings into reusable components (AppInfoSection, AutoSyncSection, GitHubConfigSection)
  - Add error-utils service with classification and ServiceResult<T> pattern
  - Implement secure-storage service with encryption support
  - Create store helpers with validation utilities
  - Add comprehensive property-based testing for new services
  - Update Tamagui 1.141.5 → 1.144.0 and Expo dependencies
  - Consolidate component exports and improve import consistency

## 1.10.0

### Minor Changes

- [#25](https://github.com/sudokoi/expense-buddy/pull/25) [`f108750`](https://github.com/sudokoi/expense-buddy/commit/f10875070606115debb5d12ee256cf6f9db34bdc) Thanks [@sudokoi](https://github.com/sudokoi)! - Add custom category management with full CRUD support
  - Create, edit, and delete custom expense categories with validation
  - Color picker for customizing category appearance
  - Reorder categories with up/down controls (Other stays fixed at bottom)
  - Category sync support with conflict resolution via merge engine
  - Automatic expense reassignment when deleting categories
  - Dynamic icon rendering for custom category icons

  Bug fixes:
  - Fix category ordering in add/edit expense flows (Other always appears last)
  - Improve EditExpenseModal with larger snap point (95%) and ScrollView
  - Show category filter in analytics empty state for filter reset
  - Centralize category sorting logic in useCategories hook

## 1.9.2

### Patch Changes

- Fixed settings sync bugs where settings weren't being synced despite showing pending count, sync count wasn't resetting when toggling settings back to original values, and sync count wasn't properly resetting after successful sync. Replaced boolean sync tracking with hash-based comparison to accurately detect actual changes.

## 1.9.1

### Patch Changes

- Implement git-style sync with fetch-merge-push flow

  This release introduces a safer synchronization mechanism that prevents accidental data loss when syncing expenses across devices.

  **Key changes:**
  - **Merge-first sync**: Always fetches remote data before pushing, similar to git's workflow
  - **Soft deletes**: Deleted expenses are now marked with a `deletedAt` timestamp instead of being removed, ensuring deletions sync correctly across devices
  - **Timestamp-based conflict resolution**: When the same expense is edited on multiple devices, the newer version wins automatically
  - **True conflict detection**: Prompts user only when edits happen within the same time window
  - **Detailed sync feedback**: Shows counts of added, updated, and auto-resolved items after sync

  **Breaking changes:**
  - Expenses now include an optional `deletedAt` field (backward compatible - existing data works without migration)

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
