# Privacy Policy

**Expense Buddy**  
**Last Updated:** December 28, 2025

## Overview

Expense Buddy is a free, open-source expense tracking application licensed under the MIT License. This privacy policy explains how the app handles your data.

## Data Collection

**We do not collect any data.**

Expense Buddy does not collect, store, transmit, or share any personal information or usage data with us or any third parties. The app operates entirely on your device.

## Data Storage

All expense data you enter is stored locally on your device using:

- **AsyncStorage** for expense records
- **Expo SecureStore** for sensitive configuration (like GitHub tokens)

Your data never leaves your device unless you explicitly choose to sync it to GitHub (see below).

## GitHub Sync (Optional)

If you choose to use the optional GitHub sync feature:

- **You provide your own GitHub Personal Access Token (PAT)**
- **You choose which repository to sync to**
- **Your expense data is uploaded directly to your own GitHub repository**
- **We have no access to your GitHub credentials or synced data**

The sync happens directly between your device and GitHub's servers. We do not operate any intermediary servers and have no visibility into your synced data.

## Third-Party Services

The app does not integrate with any analytics, advertising, or tracking services. The only external service the app can connect to is GitHub, and only if you explicitly configure it.

## Permissions

The app may request the following permissions:

- **Internet Access**: Required only for the optional GitHub sync feature
- **Secure Storage**: To safely store your GitHub token on your device

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

**Summary:** Expense Buddy is a privacy-focused app. We don't collect your data. Everything stays on your device unless you choose to sync to your own GitHub repository.
