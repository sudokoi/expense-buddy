# Expense Buddy

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

Expense Buddy is a privacy-first expense tracker built with React Native and Expo, designed around one core idea: turn transaction SMS messages into draft expenses automatically, let you review them on-device, and keep the confirmed data synced to a GitHub repository you control.

Manual entry, analytics, multi-currency support, and GitHub sync are all there, but the product's differentiator is the import pipeline: scan recent Android SMS messages, extract likely expenses, stage them locally, and import only what you approve.

## Why Expense Buddy

- Auto-detect likely expenses from Android transaction SMS messages
- Keep raw SMS content on-device and out of GitHub sync
- Review, edit, reject, or dismiss imported items before they become expenses
- Sync confirmed expenses across devices using your own private GitHub repository
- Track expenses manually too, with custom categories, payment methods, and saved instruments
- Explore spending with charts, filters, and multi-currency analytics

## Auto-Import First

Expense Buddy currently ships a regex-first SMS import pipeline for Android. That means the parser is deterministic, explainable, and easy to validate against real messages. The current flow is intentionally review-first: the app finds likely transactions, stages them locally, and waits for your approval before anything is added to your expense history.

Today, the import system:

- scans a recent SMS window on Android
- uses deterministic regex rules for transaction extraction
- suggests only shipped default categories for safety
- falls back to `Other` when no safe category match exists
- keeps raw SMS data local to the device

Planned direction:

- keep the import flow fully on-device
- broaden parser coverage beyond the initial regex packs
- evaluate on-device ML models as a future replacement for parts of the regex pipeline if coverage or maintenance cost becomes the bottleneck

That future ML direction is not shipping today. The current release is regex-based by design.

## Features

### SMS Import and Review

- Android-only SMS import using the native `expense-buddy-sms-import` module
- Inline `READ_SMS` permission handling from Settings
- Review queue where each staged item can be accepted, edited, rejected, or dismissed
- Conservative category suggestion resolver built around shipped default categories
- Local-only processing with no backend parsing

### Expense Tracking

- Quick add flow with amount, category, date, notes, and payment method
- Optional math expression entry like `120+30`
- Custom categories with icons, colors, editing, and reordering
- Saved payment instruments for cards and UPI handles
- Full create, edit, delete, and soft-delete sync behavior
- Day-level detail view and searchable history

### GitHub Sync

- Private repository sync using a fetch-merge-push workflow
- Daily CSV files in `expenses-YYYY-MM-DD.csv` format
- Optional settings sync for non-sensitive app settings
- Dirty-day tracking so only changed dates are re-uploaded
- Differential fetch and upload using remote blob SHA caching
- Timestamp-based auto-resolution with true conflict detection when needed
- Manual sync controls plus optional auto-sync on launch or on change

### Analytics

- Daily trend charts and category or payment-method breakdowns
- Multi-currency grouping and filtering
- Advanced filters for date range, amount, search text, categories, methods, and saved instruments
- Shared filter state between History and Analytics

### User Experience

- Works on Android, iOS, and Web for core expense tracking
- SMS import is Android-only and requires a native build
- Dynamic locale loading for English (US, UK, IN), Hindi, and Japanese
- Dark mode, changelog gating, update notifications, and reusable Tamagui UI primitives

## How the SMS Import Flow Works

1. Open Settings and scan recent messages.
2. Expense Buddy reads recent Android transaction SMS messages on-device.
3. The parser extracts likely transaction details and stages them locally.
4. You review each candidate and decide whether to accept, edit, reject, or dismiss it.
5. Only accepted items become normal expense records and participate in optional GitHub sync.

This review-first model is deliberate. The app aims to reduce manual entry without hiding how an import decision was made.

## Getting Started

### Prerequisites

- Node.js 24.x or higher
- Yarn 4.5.0
- Expo CLI
- For iOS: Xcode and CocoaPods
- For Android: Android Studio and SDK
- For SMS import development: an Android development build or release build, because Expo Go cannot load the custom native SMS module

### Installation

```bash
git clone https://github.com/sudokoi/expense-buddy.git
cd expense-buddy
yarn install
yarn start
```

### Run the app

- iOS: `yarn ios`
- Android: `yarn android`
- Web: `yarn web`

## GitHub Sync Setup

### Sign in with GitHub on Android

1. Go to Settings > GitHub Sync.
2. Tap Sign in with GitHub.
3. Approve the device-flow code in the browser.
4. Pick a personal repository you own and can write to.
5. Save the branch and test the connection.

### Token-based setup for Web or fallback use

1. Create a GitHub Personal Access Token.
2. Grant `Contents: Read and write` for a fine-grained token, or use the classic `repo` scope for a private repository.
3. In the app, enter the token, repository in `owner/repo` format, and branch.
4. Save the config and test the connection.

### Auto-sync options

- Sync on app launch
- Sync after every add, edit, or delete
- Manual sync with upload and download controls

## Architecture

Expense Buddy uses Expo Router for navigation, Tamagui for UI, XState stores for app state, and a service layer for sync, storage, analytics, and SMS import logic.

Key implementation details:

- file-based routing under `app/`
- XState stores for expenses, settings, filters, notifications, UI state, and SMS review state
- service-layer sync engine for GitHub fetch, merge, conflict handling, and uploads
- native Android SMS module bridged through `services/sms-import/`
- property-based and unit tests across storage, sync, parsing, and store behavior

For the deeper architecture write-up, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Project Structure

```text
expense-buddy/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx           # dashboard
│   │   ├── add.tsx             # manual expense entry
│   │   ├── analytics.tsx       # charts and breakdowns
│   │   ├── history.tsx         # history and filters
│   │   ├── settings.tsx        # sync, import, and app settings
│   │   └── _layout.tsx
│   ├── +html.tsx
│   ├── +not-found.tsx
│   ├── day/[date].tsx          # day detail screen
│   ├── github/repo-picker.tsx  # GitHub repository selection flow
│   ├── modal.tsx
│   └── _layout.tsx
├── components/
│   ├── analytics/              # charts, filters, and analytics UI
│   ├── history/                # history list and related UI
│   ├── ui/                     # shared styled components
│   ├── NotificationStack.tsx
│   ├── Provider.tsx
│   └── SyncIndicator.tsx
├── hooks/                      # analytics, auth, sync, changelog, and update hooks
├── services/
│   ├── sms-import/
│   │   ├── android-sms-module.ts
│   │   ├── bootstrap.ts
│   │   ├── parser.ts
│   │   └── suggestion-resolver.ts
│   ├── github-sync.ts          # GitHub API client
│   ├── sync-machine.ts         # sync state machine
│   ├── sync-manager.ts         # sync orchestration
│   ├── merge-engine.ts         # conflict resolution and merge logic
│   ├── expense-storage.ts      # local expense persistence
│   ├── settings-manager.ts     # settings persistence and sync support
│   ├── update-checker.ts
│   └── auto-sync-service.ts
├── stores/
│   ├── expense-store.ts
│   ├── settings-store.ts
│   ├── filter-store.ts
│   ├── sms-import-review-store.ts
│   ├── notification-store.ts
│   ├── ui-state-store.ts
│   └── store-provider.tsx
├── modules/
│   └── expense-buddy-sms-import/  # native Android SMS module
├── locales/                    # en-US, en-GB, en-IN, hi, ja
├── decisions/                  # ADRs and technical decisions
├── assets/
├── constants/
├── types/
├── utils/
└── scripts/
```

## Testing

```bash
yarn test
yarn test:watch
```

The test suite includes unit tests and property-based tests for sync, storage, parsing, and state-management behavior.

## Configuration

The app does not require user-provided environment variables.

The GitHub OAuth Client ID is configured in `app.config.js` and can be overridden for local Expo development with `EXPO_PUBLIC_GITHUB_OAUTH_CLIENT_ID`.

Build profiles are defined in `eas.json`:

- `development` for dev client builds
- `preview` for internal testing
- `production` for store-ready builds
- `internal` for direct APK distribution

## Building

### Development

```bash
yarn start
```

### Production

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production

# APK for testing
eas build --platform android --profile internal
```

Release automation is documented in [.github/RELEASE.md](.github/RELEASE.md).

## Privacy

Expense Buddy does not collect user data. Expense data lives on-device by default, and optional sync writes only to the GitHub repository you configure. Raw SMS import data is processed locally and is not uploaded as part of sync.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Reporting Issues

- In the app: Settings > App Information > Report an Issue
- On GitHub: [Issue templates](https://github.com/sudokoi/expense-buddy/issues/new/choose)

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

This project uses a strict issue-first contribution process. If you want to propose a fix, feature, refactor, or documentation change, open an issue first and discuss the problem and proposed solution before sending code.

## License

Expense Buddy is available under the [AGPL-3.0 License](LICENSE).
