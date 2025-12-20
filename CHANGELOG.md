# expense-buddy

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
