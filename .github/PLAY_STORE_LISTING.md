# Google Play Store Listing

Last updated: 2026-04-18

Use this file as the source of truth for Google Play Store presence updates.

## App name

Expense Buddy

## Short description

Private expense tracker with review-first SMS import and GitHub sync

## Full description

Expense Buddy helps you track spending faster without giving up privacy or control.

You can scan recent transaction SMS messages, turn them into draft expenses, and review everything before saving. The app extracts likely expense details on-device, suggests categories locally, and lets you accept, edit, reject, or dismiss each item. Nothing is imported automatically.

Why people use Expense Buddy:

- Review-first SMS import for recent Android transaction messages
- Private local storage by default
- Charts and filters for spending insights
- Custom categories, payment methods, and saved instruments
- Optional GitHub sync for backup across your own devices
- No ads, no analytics, no forced cloud account

What makes it different:

- SMS scanning happens only when you choose
- SMS permission is requested only when you start a scan
- Raw SMS content stays on your device
- Only confirmed expenses are added to your history
- Duplicate protection helps keep imports manageable

Smarter suggestions, still under your control:

- Expense extraction stays deterministic and on-device
- Category suggestions can use a bundled on-device LiteRT model
- Low-confidence predictions fall back to local rule-based suggestions
- Review remains the final gate before anything is saved

Track expenses your way:

- Quick add, edit, and delete flows
- Optional math expression entry for faster manual input
- Notes, dates, and searchable history
- Day-wise records for clean organization
- Multi-currency analytics support

See where your money goes:

- Daily spending charts
- Category and payment-method breakdowns
- Filters for time range, amount, category, method, and instrument

Optional GitHub sync:

- Sync confirmed expense records to a private repository you own
- Choose your repository and branch
- Works offline first and syncs when you decide
- Raw SMS data and review metadata are not uploaded to GitHub

Private by design:

- No backend required to use the app
- No analytics or advertising SDKs
- Expense data stays on-device unless you enable sync
- Only expenses you confirm become part of your synced records

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
