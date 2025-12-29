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
- **Smart Categories**: Pre-defined categories (Food, Transport, Utilities, Entertainment, Health, Groceries, Other)
- **Full CRUD**: Create, read, update, and delete expenses with ease
- **History View**: Browse expenses organized by date with search and filter

### 📈 Analytics & Insights

- **Visual Charts**: Bar charts showing daily spending patterns
- **Category Breakdown**: See spending distribution across categories
- **Time-based Analysis**: Track expenses over days, weeks, and months

### ☁️ GitHub Sync

- **Secure Backup**: Sync expenses to your private GitHub repository
- **Daily File Organization**: Expenses stored as `expenses-YYYY-MM-DD.csv` files (one file per day)
- **Smart Sync**:
  - Auto-sync on app launch or after every change
  - Manual sync with upload/download controls
  - Incremental loading (last 7 days by default)
  - Automatic cleanup: deletes files for days with no expenses
- **Differential Sync**: Only uploads changed files using content hashing for efficiency
- **Batched Commits**: All file changes (uploads and deletions) are combined into a single atomic commit
- **Accurate Sync Count**: Upload button shows exact number of files that will be synced
- **Conflict Resolution**: Timestamp-based merging handles concurrent edits (latest wins)
- **Load More**: Download older expenses 7 days at a time
- **Migration Support**: Automatically migrates from old single-file format to daily files

### 🎨 User Experience

- **Cross-Platform**: Works on iOS, Android, and Web
- **Dark Mode**: Automatic theme switching with proper token-based styling
- **Reusable UI Components**: Consistent styling with `ExpenseCard`, `AmountText`, `CategoryIcon`, `ScreenContainer`, `SectionHeader`, and `CategoryCard`
- **Notifications**: Toast messages for sync status and actions
- **Offline First**: Works without internet, syncs when connected
- **First-Time Setup**: Guided flow to download existing data

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
5. Choose the date
6. Tap **Add Expense**

### Setting Up GitHub Sync

1. **Create a GitHub Personal Access Token**

   **Option A: Fine-grained token (Recommended)**
   - Go to GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - Click "Generate new token"
   - Give it a name (e.g., "Expense Buddy Sync")
   - Set expiration (recommend 90 days or longer)
   - Under "Repository access", select "Only select repositories"
   - Choose your sync repository
   - Under "Permissions" → "Repository permissions":
     - Set **Contents** to **Read and write**
   - Click "Generate token" and copy it

   **Option B: Classic token**
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Give it a name and set expiration
   - Select the `repo` scope (full control of private repositories)
   - Click "Generate token" and copy it

2. **Configure in App**
   - Go to **Settings** tab
   - Enter your GitHub token
   - Enter repository name (format: `username/repo`)
   - Enter branch name (usually `main`)
   - Tap **Save Configuration**
   - Tap **Test Connection** to verify

3. **Enable Auto-Sync** (Optional)
   - Toggle **Enable Auto-Sync**
   - Choose timing:
     - **On App Launch**: Sync when app starts
     - **On Every Change**: Sync after add/edit/delete
   - Tap **Save Auto-Sync Settings**

### Syncing Data

**Manual Sync:**

- **Upload to GitHub**: Tap "Upload to GitHub" to backup current data
- **Download from GitHub**: Tap "Download from GitHub" to restore data

**Auto-Sync:**

- Happens automatically based on your settings
- Shows notifications when sync completes
- Handles conflicts using timestamps (latest wins)

### Loading More History

- Scroll to bottom of History tab
- Tap **Load More** to download 7 more days
- Repeat to load older expenses

## 🏗️ Architecture

### Tech Stack

- **Framework**: React Native with Expo
- **Routing**: Expo Router (file-based routing)
- **UI Library**: Tamagui (universal design system)
- **State Management**: TanStack Query (React Query)
- **Storage**: AsyncStorage + Expo SecureStore
- **Charts**: react-native-gifted-charts
- **Date Handling**: date-fns
- **CSV Parsing**: PapaParse

### UI Component Library

The app includes a set of reusable styled components in `components/ui/`:

| Component         | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `AmountText`      | Displays expense/income amounts with semantic colors |
| `CategoryCard`    | Selectable category card with color theming          |
| `CategoryIcon`    | Circular icon container with category color          |
| `ExpenseCard`     | Card wrapper for expense list items                  |
| `ScreenContainer` | Scrollable screen wrapper with consistent padding    |
| `SectionHeader`   | Styled section title text                            |

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
│   ├── ui/               # Styled UI components
│   │   ├── AmountText.tsx     # Styled amount display
│   │   ├── CategoryCard.tsx   # Category selection card
│   │   ├── CategoryIcon.tsx   # Category icon with background
│   │   ├── ExpenseCard.tsx    # Expense list item card
│   │   ├── ScreenContainer.tsx # Screen wrapper with padding
│   │   ├── SectionHeader.tsx  # Section title component
│   │   └── index.ts           # Component exports
│   ├── Provider.tsx       # App providers
│   ├── NotificationStack.tsx
│   └── SyncIndicator.tsx
├── context/              # React contexts
│   ├── ExpenseContext.tsx
│   ├── notification-context.tsx
│   └── sync-status-context.tsx
├── services/             # Business logic
│   ├── sync-manager.ts   # Sync orchestration
│   ├── github-sync.ts    # GitHub API client (includes batch commit via Git Data API)
│   ├── csv-handler.ts    # CSV import/export
│   ├── daily-file-manager.ts
│   ├── hash-storage.ts   # Content hashing for differential sync
│   ├── change-tracker.ts # Record-level change tracking
│   └── auto-sync-service.ts
├── constants/            # App constants
│   └── categories.ts
├── tamagui.config.ts     # Tamagui theme configuration with getColorValue helper
└── types/               # TypeScript types
    └── expense.ts
```

## 🔧 Configuration

### Environment Variables

No environment variables needed! All configuration is done in-app.

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

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev/)
- UI powered by [Tamagui](https://tamagui.dev/)
- Charts by [react-native-gifted-charts](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts)
- Icons from [Lucide](https://lucide.dev/)

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

Made with ❤️ using React Native and Expo
