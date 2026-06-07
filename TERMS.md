# Terms and Conditions

**Expense Buddy**  
**Last Updated:** June 8, 2026

## 1. Acceptance of Terms

By downloading, installing, or using Expense Buddy ("the App"), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use the App.

## 2. Description of Service

Expense Buddy is a free, open-source expense tracking application that runs primarily on your device. The App provides tools for:

- Manual expense entry with categories, payment methods, and notes
- Optional Android SMS import for auto-detecting expenses from transaction messages
- Optional cloud sync (GitHub or Google Drive) for backing up confirmed expenses
- Spending analytics, charts, and multi-currency support

The App is provided "as is" and licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

## 3. Privacy and Data Handling

Your privacy is fundamental to Expense Buddy. The App does not collect, store, transmit, or share any personal information or usage data with us or any third parties.

### 3.1 Local Storage

All expense data is stored locally on your device using AsyncStorage and Expo SecureStore. Your data never leaves your device unless you explicitly enable cloud sync.

### 3.2 SMS Import (Android)

The SMS import feature processes transaction SMS messages entirely on-device. Raw SMS content is stored locally for review only and is never uploaded to GitHub. The feature requires your explicit action to grant `READ_SMS` and `RECEIVE_SMS` permissions.

### 3.3 Cloud Sync (Optional)

Cloud sync is entirely optional and opt-in. You can choose between GitHub or Google Drive:

- **GitHub:** Your confirmed expense data is uploaded directly to a GitHub repository you choose and control. We do not operate any intermediary servers and have no access to your GitHub credentials or synced data. Only personal repositories you own are supported.
- **Google Drive:** Your confirmed expense data is stored in Google Drive's private app data folder (`appDataFolder`), which is accessible only by this app. A Cloudflare Worker handles OAuth token exchange and refresh so your client secret is never stored in the app. We do not log, store, or access your tokens or synced data. Google's infrastructure stores your data in accordance with the [Google Privacy Policy](https://policies.google.com/privacy).

### 3.4 Device Logging (Android)

On-device operational logs are stored locally with a fixed capacity of 1000 entries. Logs contain app operation details only and never include raw SMS content, financial data, passwords, or personal information. Logs never leave your device unless you voluntarily share them when reporting a bug.

See [PRIVACY.md](PRIVACY.md) for the complete privacy policy.

## 4. User Responsibilities

### 4.1 Account and Credentials

If you choose to use cloud sync, you are responsible for maintaining the security of your credentials and access tokens:

- **GitHub:** Your personal access token is stored locally using Expo SecureStore.
- **Google Drive:** OAuth tokens are obtained via native Google Sign-In and stored locally using Expo SecureStore. Token refresh is handled through a Cloudflare Worker; no token data is persisted by the Worker.

### 4.2 Permissions

Some features require device permissions (Internet access, SMS access, notifications). These are only requested when you choose to use the associated feature. You may revoke any permission at any time through your device settings.

### 4.3 Lawful Use

You agree not to use the App for any unlawful purpose or in violation of any applicable laws or regulations.

## 5. SMS Import Feature

The SMS import feature is Android-only and operates on a review-first model:

- The App scans recent SMS messages on-device to detect likely transaction messages
- Detected transactions are staged locally for your review
- You must explicitly accept, edit, reject, or dismiss each staged item before it becomes an expense record
- Only accepted items are added to your expense history and participate in optional cloud sync
- Raw SMS content is never synced to GitHub or Google Drive

The current SMS parsing uses deterministic rules and an on-device LiteRT model for category suggestions. Category suggestions are generated locally and may be inaccurate. You are responsible for reviewing and correcting all imported data.

## 6. Cloud Sync

Cloud sync is an optional feature that allows you to back up confirmed expense records. You can choose between the following providers:

### 6.1 GitHub Sync

- Sync uses a fetch-merge-push workflow against your chosen repository
- Expenses are stored as daily CSV files in `expenses-YYYY-MM-DD.csv` format
- You must have write access to the selected repository
- The App verifies write access before enabling sync
- Organization repositories are not supported

You are solely responsible for the security and access control of the GitHub repository you use for sync.

### 6.2 Google Drive Sync

- Sync uses Google Drive's private app data folder (`appDataFolder`), which is not visible to users or other apps
- Expenses are stored as per-year JSON files
- Authentication uses native Android Google Sign-In with OAuth 2.0
- Token refresh is handled server-side by a Cloudflare Worker so your client secret is never stored in the app
- You must have a Google account signed in on your device

You are responsible for the security of your Google account and the OAuth permissions you grant to the App.

## 7. Open Source License

Expense Buddy is free and open-source software released under the GNU Affero General Public License v3.0 (AGPL-3.0). This means:

- You may use, copy, and distribute the App in accordance with the AGPL-3.0
- You may access and modify the source code
- If you modify the App and make it available to others over a network, you must make your modified source code available under the AGPL-3.0
- The full license text is available in [LICENSE](LICENSE)

## 8. Disclaimer of Warranty

THE APP IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE APP IS WITH YOU.

## 9. Limitation of Liability

IN NO EVENT SHALL THE COPYRIGHT HOLDERS, CONTRIBUTORS, OR ANY OTHER PARTY BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE APP OR THE USE OR OTHER DEALINGS IN THE APP, INCLUDING BUT NOT LIMITED TO DATA LOSS, FINANCIAL LOSSES, OR ANY OTHER DAMAGES.

## 10. Changes to These Terms

Changes to these terms will be reflected in this document with an updated "Last Updated" date. As an open-source project, all changes are publicly visible in the [GitHub repository](https://github.com/sudokoi/expense-buddy).

## 11. Contact

For questions or concerns about these terms, please open an issue on GitHub:  
https://github.com/sudokoi/expense-buddy/issues
