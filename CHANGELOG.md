# expense-buddy

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
