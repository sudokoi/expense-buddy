# Privacy Policy

**Expense Buddy**  
**Last Updated:** April 11, 2026

## Overview

Expense Buddy is a free, open-source expense tracking application licensed under the AGPL-3.0 License. This privacy policy explains how the app handles your data.

## Data Collection

**We do not collect any data.**

Expense Buddy does not collect, store, transmit, or share any personal information or usage data with us or any third parties. The app operates entirely on your device.

## Data Storage

All expense data you enter is stored locally on your device using:

- **AsyncStorage** for expense records
- **Expo SecureStore** for sensitive configuration (like GitHub tokens)

Your data never leaves your device unless you explicitly choose to sync it to GitHub (see below).

## SMS Import (Android Only)

If you enable SMS import on Android:

- **The app checks SMS permission status on startup, but only prompts for `READ_SMS` when you choose to scan recent messages**
- **Recent SMS messages are scanned on-device only**
- **Scans are bounded to the recent import window used by the current release**
- **Raw SMS sender and body content are stored locally for review only**
- **Raw SMS content, dedupe fingerprints, and review metadata are not synced to GitHub**
- **Category suggestions are generated locally from deterministic regex rules mapped to the app's default categories**
- **If no category matches, or if a suggested category was deleted, the app falls back to `Other` until you confirm or edit the item**
- **Only expenses you explicitly confirm are added to your normal expense records**

The current SMS import flow is review-first. Messages that match supported transaction patterns are staged locally until you accept, reject, dismiss, or clear them.

## GitHub Sync (Optional)

If you choose to use the optional GitHub sync feature:

- **On Android, you can sign in with GitHub** (device authorization flow) and choose a repository
- **On web, you can use a GitHub Personal Access Token (PAT)** (fallback/testing)
- **You choose which repository and branch to sync to**
- **Only personal repositories you own are supported** (organization repositories are not supported)
- **Write access is required** (the app verifies you can push to the selected repo)
- **Your expense data is uploaded directly to your own GitHub repository**
- **We have no access to your GitHub credentials or synced data**

The sync happens directly between your device and GitHub's servers. We do not operate any intermediary servers and have no visibility into your synced data.

## Third-Party Services

The app does not integrate with any analytics, advertising, or tracking services. The only external service the app can connect to is GitHub, and only if you explicitly configure it.

## Permissions

The app may request the following permissions:

- **Internet Access**: Required only for the optional GitHub sync feature
- **Secure Storage**: To safely store your GitHub token on your device
- **SMS Access (`READ_SMS`)**: Required only if you choose to use Android SMS import; the app requests it when you manually start a scan from Settings

## Children's Privacy

This app does not knowingly collect any information from children under 13 years of age.

## Changes to This Policy

Any changes to this privacy policy will be reflected in this document with an updated "Last Updated" date. As an open-source project, all changes are publicly visible in the [GitHub repository](https://github.com/sudokoi/expense-buddy).

## Open Source

Expense Buddy is open source. You can review the complete source code at:  
https://github.com/sudokoi/expense-buddy

## Contact

For questions or concerns about this privacy policy, please open an issue on GitHub:  
https://github.com/sudokoi/expense-buddy/issues

---

**Summary:** Expense Buddy is a privacy-focused app. We don't collect your data. Everything stays on your device unless you choose to sync confirmed expense records to your own GitHub repository.
