# Expense Buddy 💰

<p align="center">
  <img src="./assets/images/expense-buddy.png" alt="Expense Buddy Logo" width="200"/>
</p>

<p align="center">
  <a href="https://play.google.com/store/apps/details?id=com.sudokoi.expensebuddy"><img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" height="80" /></a>
</p>

<p align="center">
  <a href="https://github.com/sudokoi/expense-buddy/releases/latest"><img src="https://img.shields.io/github/v/release/sudokoi/expense-buddy?label=release" alt="Latest Release" /></a>
  <a href="https://github.com/sudokoi/expense-buddy/actions/workflows/release-local.yml"><img src="https://github.com/sudokoi/expense-buddy/actions/workflows/release-local.yml/badge.svg" alt="Build Status" /></a>
</p>

A modern, cross-platform expense tracking app built with React Native and Expo. Track your daily expenses, visualize spending patterns, and sync your data securely to GitHub.

## ✨ Features

### 📊 Expense Management

- **Quick Entry**: Add expenses with amount, category, date, and notes
- **Custom Categories**: Create, edit, and reorder expense categories with custom colors and icons
- **Payment Methods**: Track how you pay (Cash, UPI, Credit Card, Debit Card, Net Banking, Amazon Pay, etc.)
- **Saved Payment Instruments**: Save your commonly used cards/UPI IDs with nicknames
  - Cards store only last **4** digits, UPI stores only last **3** digits
  - Expenses can reference a saved instrument by ID (CSV stays backward compatible)
- **Default Payment Method**: Set a preferred payment method for faster entry
- **Full CRUD**: Create, read, update, and delete expenses with ease
- **History View**: Browse expenses organized by date with search and filter

### 📈 Analytics & Insights

- **Visual Charts**: Bar charts showing daily spending patterns
- **Category Breakdown**: See spending distribution across categories
- **Payment Method Analysis**: Pie chart showing expense distribution by payment method
- **Multi-Currency Support**: Analytics automatically groups expenses by currency; filter chips appear when multiple currencies are present
- **Filters**: Filter analytics by category, payment method, currency, and (when applicable) saved instrument
- **Instrument Breakdown**: See spending per card/UPI nickname for selected payment methods
- **Time-based Analysis**: Track expenses over days/weeks/months plus 3m / 6m / 1y windows

### ☁️ GitHub Sync

- **Secure Backup**: Sync expenses to your private GitHub repository
- **Optional Settings Sync**: Also sync non-sensitive app settings (like categories and saved payment instruments) via `settings.json`
  - Off by default; controlled by a toggle in Settings
  - GitHub token/repo configuration is never synced (stays on-device)
- **Daily File Organization**: Expenses stored as `expenses-YYYY-MM-DD.csv` files (one file per day)
- **Git-Style Sync**: Fetch-merge-push workflow prevents accidental data loss
  - Always fetches remote data before pushing
  - Merges local and remote changes by expense ID
  - Timestamp-based auto-resolution (newer version wins)
  - True conflict detection when edits happen within the same time window
- **Soft Delete**: Expenses are marked with `deletedAt` timestamp instead of being removed, ensuring deletions sync correctly across devices
- **Smart Sync**:
  - Auto-sync on app launch or after every change
  - Manual sync with upload/download controls
  - Incremental loading (last 7 days by default)
- **Differential Sync**: Only uploads changed files using content hashing for efficiency
- **Batched Commits**: All file changes (uploads and deletions) are combined into a single atomic commit
- **Detailed Sync Feedback**: Shows counts of expenses added, updated, and auto-resolved
- **Load More**: Download older expenses 7 days at a time
- **Migration Support**: Automatically migrates from old single-file format to daily files

### 🌍 Internationalization (i18n)

- **Multiple Languages**: Full support for **English (US, UK, IN)**, **Hindi (हिंदी)**, and **Japanese (日本語)**
- **Dynamic Locale Loading**: Only the active locale is bundled at startup for faster app launch; other locales load on-demand when selected
- **Locale Awareness**:
  - Currency symbols adapt to your choice ($, £, ₹)
  - Date formats match your region
- **Per-Transaction Currency**: Track expenses in any currency (useful for travel)
- **Persistent Preferences**: Remembers your language and default currency settings

### 🎨 User Experience

- **Cross-Platform**: Works on iOS, Android, and Web
- **Dark Mode**: Automatic theme switching with proper token-based styling
- **In-App Updates**: Automatic update check on launch with non-intrusive banner notification
  - Dismissible notifications that remember your choice per version
  - Manual check available in Settings
  - Opens Play Store or GitHub releases based on install source
  - Shows a one-time “What’s New” changelog sheet on first launch after updating (when release notes exist)
- **Reusable UI Components**: Consistent styling with `ExpenseCard`, `AmountText`, `CategoryIcon`, `ScreenContainer`, `SectionHeader`, and `CategoryCard`
- **Notifications**: Toast messages for sync status and actions
- **Offline First**: Works without internet, syncs when connected
- **First-Time Setup**: Guided flow to download existing data
- **Performance Optimized**: Virtualized lists + memoized components/handlers for smooth scrolling with large datasets

## 🚀 Getting Started

### Prerequisites

- Node.js 24.x or higher
- Yarn 4.5.0 (included via packageManager)
- Expo CLI
- For iOS: Xcode and CocoaPods
- For Android: Android Studio and SDK

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/sudokoi/expense-buddy.git
   cd expense-buddy
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **Start the development server**

   ```bash
   yarn start
   ```

4. **Run on your platform**
   - iOS: `yarn ios`
   - Android: `yarn android`
   - Web: `yarn web`

## 📱 Usage

### Adding an Expense

1. Tap the **+** tab
2. Enter the amount
3. Select a category
4. Add a note (optional)
5. Choose your payment method
6. If you selected Credit/Debit/UPI, optionally select a saved instrument (or choose **Others** and enter digits)
7. Choose the date
8. Tap **Add Expense**

### Managing Payment Instruments

1. Go to the **Settings** tab
2. Find **Saved Instruments**
3. Tap **Add** to create a new card/UPI nickname
4. Edit or remove instruments as needed (removals are soft-deletes so they sync correctly)

### Setting Up GitHub Sync

1. **Sign in with GitHub (Android)**
   - Go to the **Settings** tab → **GitHub Sync**
   - Tap **Sign in with GitHub**
   - A browser will open and GitHub will show a short **code**
   - Confirm the code and authorize access
   - Back in the app, choose a **personal repository you own**
     - Organization repositories are not supported
     - Only repositories where you have **write access** are shown
   - Enter/select a branch (usually `main`)
   - Tap **Save Config** and then **Test**

2. **Use a token instead (Web / fallback)**
   - Create a GitHub Personal Access Token (PAT)

     **Option A: Fine-grained token (Recommended)**
     - GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
     - Generate new token, select the sync repository
     - Permissions → Repository permissions → **Contents: Read and write**

     **Option B: Classic token**
     - GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
     - Select the `repo` scope (required for private repositories)

   - In the app, enter:
     - Token
     - Repository in `owner/repo` format
     - Branch (usually `main`)
   - Tap **Save Config** and then **Test**

3. **Enable Auto-Sync** (Optional)
   - Toggle **Enable Auto-Sync**
   - Choose timing:
     - **On App Launch**: Sync when app starts
     - **On Every Change**: Sync after add/edit/delete
   - Tap **Save Auto-Sync Settings**

### Syncing Data

**Smart Sync:**

- Tap **Sync Now** – uses git-style fetch-merge-push:
  - Fetches all remote expenses first
  - Merges with local data (newer timestamps win)
  - Prompts only for true conflicts (same expense edited on both sides within seconds)
  - Pushes merged result to remote

**Auto-Sync:**

- Happens automatically based on your settings
- Shows notifications when sync completes with detailed counts
- Handles conflicts using timestamps (latest wins)

### Loading More History

- Scroll to bottom of History tab
- Tap **Load More** to download 7 more days
- Repeat to load older expenses

## 🏗️ Architecture

### Tech Stack

- **Framework**: React Native with Expo
- **Routing**: Expo Router (file-based routing)
- **UI Library**: Tamagui v1.144.0 (universal design system)
- **State Management**: XState Store v3 (reactive stores) + XState v5 (sync state machine)
- **Storage**: AsyncStorage + Expo SecureStore (with encryption utilities)
- **Charts**: react-native-gifted-charts
- **Date Handling**: date-fns
- **CSV Parsing**: PapaParse
- **Testing**: Jest + fast-check (property-based testing)
- **Error Handling**: Centralized error utilities with classification
- **Type Safety**: Comprehensive TypeScript with ServiceResult pattern

### UI Component Library

The app includes a comprehensive set of reusable styled components:

**Core UI Components** (`components/ui/`):

| Component                         | Description                                                |
| --------------------------------- | ---------------------------------------------------------- |
| `AmountText`                      | Displays expense/income amounts with semantic colors       |
| `CategoryCard`                    | Selectable category card with color theming                |
| `CategoryIcon`                    | Circular icon container with category color                |
| `ExpenseRow`                      | Shared, memoized expense row UI (used across lists)        |
| `ExpenseCard`                     | Card wrapper for expense list items                        |
| `ScreenContainer`                 | Scrollable screen wrapper with consistent padding          |
| `SectionHeader`                   | Styled section title text                                  |
| `SettingsSection`                 | Card wrapper for settings groups                           |
| `ThemeSelector`                   | Theme preference selector (light/dark/system)              |
| `DefaultPaymentMethodSelector`    | Payment method preference selector                         |
| `PaymentMethodCard`               | Selectable payment method display card                     |
| `CategoryFormModal`               | Modal for creating/editing custom categories               |
| `AppSheetScaffold`                | Shared layout wrapper for Tamagui `Sheet` screens/modals   |
| `ColorPickerSheet`                | Bottom sheet for selecting category colors                 |
| `DynamicCategoryIcon`             | Runtime icon rendering for custom categories               |
| `UpdateBanner`                    | Non-intrusive update notification banner                   |
| `ChangelogSheet`                  | One-time “What’s New” sheet shown after updates            |
| `PaymentInstrumentInlineDropdown` | Inline selector to pick a saved instrument or enter digits |
| `PaymentInstrumentFormModal`      | Create/edit a saved payment instrument                     |

### Local Expense Storage

Expenses are stored locally using AsyncStorage.

- The app uses an incremental storage layout (index + per-expense keys) to avoid rewriting the entire expense dataset on every add/edit/delete.
- A one-time automatic migration runs on startup if legacy storage is detected.
- GitHub sync format is unchanged (still daily CSV files); this is purely on-device storage.

**Settings Components** (`components/ui/settings/`):

| Component                   | Description                                  |
| --------------------------- | -------------------------------------------- |
| `AppInfoSection`            | App version and build information display    |
| `AutoSyncSection`           | Auto-sync configuration with timing controls |
| `GitHubConfigSection`       | GitHub repository and token configuration    |
| `PaymentInstrumentsSection` | Add/edit/remove saved cards and UPI IDs      |

**Analytics Components** (`components/analytics/`):

| Component                           | Description                               |
| ----------------------------------- | ----------------------------------------- |
| `PaymentMethodPieChart`             | Payment method breakdown visualization    |
| `PaymentMethodFilter`               | Payment method chip filter                |
| `AnalyticsFiltersSheet`             | Analytics filters sheet with Apply action |
| `CollapsibleSection`                | Collapsible chart wrapper with headers    |
| `CategoryFilter`                    | Category selection filter for analytics   |
| `PaymentInstrumentFilter`           | Instrument chip filter (contextual)       |
| `TimeWindowSelector`                | Time window picker for analytics          |
| `PaymentInstrumentPieChart`         | Instrument breakdown visualization        |
| `PaymentInstrumentBreakdownSection` | Instrument breakdown section with filters |

All components use Tamagui's token-based styling system with the `getColorValue()` helper for type-safe theme color extraction.

### Project Structure

```
expense-buddy/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Dashboard with charts
│   │   ├── add.tsx        # Add expense screen
│   │   ├── history.tsx    # Expense history with edit/delete
│   │   ├── settings.tsx   # Sync settings
│   │   └── _layout.tsx    # Tab layout
│   ├── day/[date].tsx     # Day detail view
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
│   ├── analytics/        # Analytics chart components
│   │   ├── PaymentMethodPieChart.tsx  # Payment method breakdown
│   │   └── CollapsibleSection.tsx     # Collapsible chart wrapper
│   ├── ui/               # Styled UI components
│   │   ├── AmountText.tsx     # Styled amount display
│   │   ├── CategoryCard.tsx   # Category selection card
│   │   ├── CategoryIcon.tsx   # Category icon with background
│   │   ├── ExpenseCard.tsx    # Expense list item card
│   │   ├── ScreenContainer.tsx # Screen wrapper with padding
│   │   ├── SectionHeader.tsx  # Section title component
│   │   ├── DefaultPaymentMethodSelector.tsx # Payment method preference
│   │   ├── PaymentMethodCard.tsx  # Payment method display card
│   │   └── index.ts           # Component exports
│   ├── Provider.tsx       # App providers
│   ├── NotificationStack.tsx
│   └── SyncIndicator.tsx
├── hooks/                # React hooks
│   ├── use-sync-machine.ts   # XState sync machine React hook
│   └── use-update-check.ts   # In-app update check hook
├── stores/               # XState Store state management
│   ├── expense-store.ts      # Expense data store
│   ├── settings-store.ts     # App settings store
│   ├── notification-store.ts # Toast notifications store
│   ├── hooks.ts              # Custom hooks (useExpenses, useSettings, etc.)
│   ├── store-provider.tsx    # Store initialization provider
│   └── index.ts              # Store exports
│   └── __tests__/            # Unit and property-based tests
├── services/             # Business logic
│   ├── sync-machine.ts   # XState sync state machine (idle/fetching/merging/pushing/conflict/error)
│   ├── sync-manager.ts   # Sync orchestration
│   ├── merge-engine.ts   # Git-style merge logic (ID-based merge, timestamp resolution)
│   ├── github-sync.ts    # GitHub API client (includes batch commit via Git Data API)
│   ├── csv-handler.ts    # CSV import/export
│   ├── daily-file-manager.ts
│   ├── hash-storage.ts   # Content hashing for differential sync
│   ├── change-tracker.ts # Record-level change tracking
│   ├── expense-storage.ts # Incremental local expense storage + migration
│   ├── payment-instruments.ts # Instrument utilities + validation
│   ├── payment-instruments-migration.ts # One-time linking migration for legacy expenses
│   ├── payment-instrument-merger.ts # Merge logic for syncing instruments
│   └── auto-sync-service.ts
├── constants/            # App constants
│   ├── categories.ts
│   ├── payment-methods.ts    # Payment method definitions
│   └── payment-method-colors.ts  # Chart colors for payment methods
├── tamagui.config.ts     # Tamagui theme configuration with getColorValue helper
└── types/               # TypeScript types
  ├── expense.ts
  └── payment-instrument.ts
```

## 🧪 Testing

The app includes comprehensive unit tests and property-based tests:

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch
```

### Test Coverage

- **Unit Tests**: Coverage for services, stores, and critical utilities
- **Property-Based Tests**: fast-check properties validating merge/sync/store correctness
- **Test Files**: Located in `stores/__tests__/` and `services/`

## 🔧 Configuration

### Environment Variables

The app does not require user-provided environment variables.

The GitHub OAuth Client ID is configured in `app.config.js` (not a secret). For Expo Go / local dev you can override it via `EXPO_PUBLIC_GITHUB_OAUTH_CLIENT_ID`.

### EAS Build Profiles

Defined in `eas.json`:

- **development**: Development client with hot reload
- **preview**: Internal distribution for testing
- **production**: Production builds with auto-increment
- **internal**: APK builds for direct distribution

## 📦 Building

### Development Build

```bash
yarn start
```

### Production Build

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production

# APK for testing
eas build --platform android --profile internal
```

### Automated Releases

See [.github/RELEASE.md](.github/RELEASE.md) for automated APK builds via GitHub Actions.

## 🐛 Reporting Issues

Found a bug or have a feature request? We'd love to hear from you!

**In-App Reporting:**

- Open the app and go to **Settings**
- Scroll to **APP INFORMATION**
- Tap **Report an Issue**
- Choose between Bug Report or Feature Request

**GitHub Issues:**

- Visit [github.com/sudokoi/expense-buddy/issues](https://github.com/sudokoi/expense-buddy/issues/new/choose)
- Select the appropriate template
- Fill in the details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes and **create a changeset**:
   ```bash
   yarn changeset
   ```
4. Commit your changes with the changeset:
   ```bash
   git add .
   git commit -m 'feat: add some amazing feature'
   ```
5. Push to the branch (`git push origin feature/AmazingFeature`)
6. Open a Pull Request

### Changelog Management

This project uses [Changesets](https://github.com/changesets/changesets) for version management and automated changelog generation.

**When contributing:**

- Run `yarn changeset` to document your changes
- Select change type: `patch` (bug fixes), `minor` (new features), or `major` (breaking changes)
- Write a clear description of what changed
- Commit the generated changeset file with your PR

**Automated releases:**

- When PRs with changesets are merged, a "Version Packages" PR is automatically created
- Merging the Version PR triggers automatic tag creation
- Tag push triggers APK build and GitHub Release creation
- See [.github/RELEASE.md](.github/RELEASE.md) for the full workflow

## 🔒 Privacy Policy

Expense Buddy does not collect any data. All your expense data is stored locally on your device. The optional GitHub sync feature uses your own credentials and repository. Read the full [Privacy Policy](PRIVACY.md).

## 📝 License

This project is open source and available under the [AGPL-3.0 License](LICENSE).

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev/)
- UI powered by [Tamagui](https://tamagui.dev/)
- Charts by [react-native-gifted-charts](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts)
- Icons from [Lucide](https://lucide.dev/)

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

Made with ❤️ using React Native and Expo
