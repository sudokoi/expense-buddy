# Google Play Store Listing

Last updated: 2026-04-14

Use this file as the source of truth for Google Play Store presence updates.

## App name

Expense Buddy

## Short description

Private expense tracker with SMS import review, charts, and secure sync

## Full description

Expense Buddy is a privacy-first expense tracker for Android built around one core idea: make expense tracking feel automatic.

The app is designed to turn transaction SMS into expenses with as little manual work as possible. Today, Expense Buddy scans recent transaction messages on-device, prepares likely expenses for review, and lets you confirm the final result before saving.

This review-first flow is the current step toward a more automatic future. The product direction is clear: smarter auto-import, less manual cleanup, and on-device intelligence that helps categorize expenses without sending your personal data to a server.

Why Expense Buddy:

- SMS-driven expense import as the core app experience
- Review-first auto-import for recent Android transaction messages
- Private local storage by default
- Optional GitHub sync for backup across devices
- Charts and filters to understand spending trends
- Custom categories, payment methods, and saved instruments
- No ads, no analytics, no forced cloud account

SMS import and review:

- Scan recent transaction SMS on Android when you choose
- SMS permission is requested only when you start a scan
- Raw SMS content stays on your device for review
- Expense Buddy detects likely expenses from recent messages and stages them for confirmation
- Review, edit, accept, reject, or dismiss detected transactions
- Only confirmed expenses are added to your expense history
- Duplicate protection and recent-scan limits help keep imports manageable

Built for smarter import over time:

- Current release: deterministic on-device parsing with review before save
- Planned direction: stronger auto-import flows with less manual intervention
- Planned direction: on-device ML assistance for basic expense categorization
- Privacy goal: keep categorization and import intelligence on-device

Expense tracking:

- Quick add, edit, and delete flows
- Custom categories with colors and icons
- Payment method tracking with saved cards and UPI instruments
- Notes, dates, and searchable history
- Day-wise organization for clean records

Insights and analysis:

- Daily spending charts
- Category breakdowns
- Payment method analysis
- Filters for time range, category, method, and instrument

Optional GitHub sync:

- Sync confirmed expense records to a private repository you own
- Sign in with GitHub and choose the repository and branch
- Merge-based sync flow designed to avoid accidental data loss
- Works offline first and syncs when you decide

Privacy first:

- No analytics or advertising SDKs
- No backend required to use the app
- Expense data stays on-device unless you enable sync
- Raw SMS data and review metadata are not uploaded to GitHub
- Only expenses you confirm can become part of your synced records

Open source and free:

Expense Buddy is free and open source. You can report issues from the app's Settings screen or through the GitHub repository.

Privacy Policy: https://github.com/sudokoi/expense-buddy/blob/main/PRIVACY.md

## Store copy guardrails

Keep these claims accurate in Play Store updates:

- Describe SMS import as Android-only.
- Describe SMS import as manual, recent-message scanning and review-first.
- If future direction is mentioned, clearly label it as planned and not current behavior.
- Do not imply background SMS monitoring or automatic expense creation.
- Keep GitHub sync clearly optional.
- Keep privacy claims aligned with [PRIVACY.md](./../PRIVACY.md).
