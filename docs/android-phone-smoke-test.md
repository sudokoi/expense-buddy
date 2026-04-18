# Android Phone Smoke Test

Use this after building the internal APK to verify the settings revamp, GitHub settings sync, and the new on-device SMS ML toggle on a real phone.

## Install

1. Build the APK with `yarn build:android:internal:local`.
2. Copy `build/expense-buddy-internal.apk` to your phone.
3. Install the APK and grant the permissions you normally use for testing.

## Settings UX

1. Open the Settings tab and confirm the top-level order is: Sync, SMS Import on Android, Payment, Feature Flags, General, Localization, About.
2. Confirm the Payment card opens the dedicated payment screen instead of expanding inline.
3. On the payment screen, confirm the overview cards reflect the current default payment method, saved instrument count, and category count.
4. Change the default payment method and verify new expenses preselect it.
5. Add, edit, and remove a saved instrument.
6. Add, edit, delete, and reorder categories. Confirm `Other` stays last and cannot be deleted.

## Feature Flags And SMS ML

1. In Settings, enable `Allow mathematical amount entry` and verify an amount like `120+45` resolves correctly when adding an expense.
2. On Android, disable `Use ML model only for SMS import inferences (experimental)`.
3. Run an SMS scan and note at least one category suggestion that comes from regex.
4. Enable the ML-only flag and scan again with the same or similar transaction messages.
5. Confirm the review queue still opens and that category suggestions now prefer the native ML result when a prediction exists.

## GitHub Settings Sync

1. Configure GitHub sync and enable `Also sync settings`.
2. Change at least these settings: theme, default payment method, `Allow mathematical amount entry`, and the ML-only SMS flag.
3. Tap `Sync Now` and confirm the success notification.
4. In the synced repository, inspect `settings.json` and verify it includes `version: 8` and `useMlOnlyForSmsImports`.
5. On a second install, another device, or after clearing local app data, sync down and confirm the settings are restored.

## Model Wiring Sanity Check

1. Use a few real transaction SMS messages that should map to different categories.
2. Confirm suggestions are returned without crashes during scan or review.
3. If category suggestions look obviously wrong, note the sender, message text, predicted category, and whether the ML-only flag was enabled so the regression can be reproduced.
