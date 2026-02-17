---
"expense-buddy": major
---

# Expense Buddy v3.0.0 - SMS Import Release

## 🎉 Major Release: SMS Expense Import & Android-Only

This is a **major release** that introduces automatic SMS expense import functionality and transitions the app to Android-only to leverage platform-specific features.

### ⚠️ Breaking Changes

- **Platform Support**: App now supports **Android 14+ only**
  - Removed iOS support
  - Removed Web support
  - Minimum Android SDK: API 34 (Android 14)
- **CSV Format**: Updated to v2.0 with new columns (`source`, `importMetadata`)
  - Backward compatible import (reads v1.0 and v2.0)
  - Export always produces v2.0 format
- **Settings Migration**: Automatic migration from v6 to v7 (adds `smsImportSettings`)

### ✨ New Features

#### 📱 SMS Expense Import (Android Only)

- **Automatic Detection**: Automatically detects expenses from bank SMS messages
- **Smart Parsing Engine**: Supports major banks across multiple regions:
  - **Indian Banks**: HDFC, ICICI, SBI, Axis, Kotak
  - **US Banks**: Chase, Bank of America, Wells Fargo, Citi
  - **EU Banks**: Revolut, N26, ING
  - **JP Banks**: MUFG, SMBC, Mizuho
  - **UPI Wallets**: PhonePe, Paytm
- **Manual Review Queue**: All imports require user confirmation before saving
- **Learning System**: Learns from your corrections to improve future suggestions
  - Merchant → Category mapping
  - Merchant → Payment method mapping
  - Cross-device sync via GitHub
- **Duplicate Prevention**: Message fingerprinting prevents duplicate imports
- **Privacy-First**: 100% on-device processing, no SMS content leaves your device

#### 🏗️ New Services & Components

**Core Services** (`services/sms-import/`):

- `transaction-parser.ts` - Regex-based SMS parsing with international bank support
- `duplicate-detector.ts` - Fingerprinting and similarity-based deduplication
- `learning-engine.ts` - Merchant pattern learning with fuzzy matching
- `sms-listener.ts` - SMS monitoring service (ready for native module)
- `settings.ts` - SMS import settings management
- `permissions.ts` - Android SMS permission handling

**New Types**:

- `types/sms-import.ts` - SMS import type definitions
- `types/merchant-patterns.ts` - Learning system types

**New Store**:

- `stores/review-queue-store.ts` - XState store for managing import review queue

**New UI**:

- `components/ui/sms-import/SMSImportSection.tsx` - Settings UI for SMS import

### 🔧 Technical Improvements

#### Data Model Enhancements

- **Expense Type**: Added `source` and `importMetadata` fields
  - `source`: "manual" | "auto-imported"
  - `importMetadata`: SMS content, sender, confidence score, timestamps
- **CSV v2.0**: Added `#version: 2.0` header and new columns
- **Settings v7**: Added `smsImportSettings` with enable/disable toggle

#### Sync Architecture Updates

- **Merchant Pattern Sync**: Learning data syncs via GitHub (`merchant-patterns.json`)
- **Opt-out by Default**: Follows existing settings sync toggle
- **Merge Strategy**: Usage count-based conflict resolution

#### Performance Optimizations

- **Batch Processing**: Auto-imported expenses don't trigger immediate sync
- **Efficient Storage**: Rotating window of 1,000 processed message IDs
- **Smart Pattern Matching**: 24-hour overwrite window for merchant variations

### 📊 Testing

Comprehensive test coverage added:

- **Transaction Parser Tests**: 13 test suites covering all bank patterns
- **Duplicate Detector Tests**: Similarity calculation and fingerprinting
- **Learning Engine Tests**: Pattern learning, merchant matching, suggestions

### 📚 Documentation Updates

- **README.md**: Added platform support section, SMS import features, configuration guide
- **PRIVACY.md**: Added SMS import privacy section, permission details
- **ARCHITECTURE.md**: Added SMS import architecture section with flow diagrams
- **Implementation Doc**: Comprehensive technical specification in `docs/SMS_IMPORT_IMPLEMENTATION.md`

### 🔒 Privacy & Security

- **On-Device Only**: All SMS processing happens locally
- **No Cloud Services**: No third-party SMS parsing APIs
- **Minimal Data**: Only parsed expense data stored (not raw SMS)
- **Opt-In**: Feature disabled by default, requires explicit enable
- **Permission Control**: SMS permission can be revoked anytime

### 📱 Permissions

New permissions required (Android only):

- `READ_SMS`: Read incoming bank transaction SMS
- `RECEIVE_SMS`: Detect new SMS in real-time

### 🔄 Migration Guide

**For Existing Users:**

1. Export your data before updating (CSV export)
2. Install v3.0.0 on Android 14+ device
3. Import your data (backward compatible)
4. Enable SMS Import in Settings (optional)

**For Developers:**

- Settings automatically migrate from v6 to v7
- CSV import supports both v1.0 and v2.0 formats
- No breaking changes to expense data structure

### 📦 Dependencies

**New Dependencies**:

- `@maniac-tech/react-native-expo-read-sms`: SMS reading capability (to be installed)
- `expo-notifications`: Notification support

**Removed Dependencies**:

- `react-dom`: Web support removed
- `react-native-web`: Web support removed

### 🎯 Known Limitations

- SMS import requires Android 14+ (API 34)
- All imports go through review queue in v1 (no auto-import bypass)
- Merchant learning requires multiple confirmations for high confidence
- Pattern sync requires GitHub sync to be enabled

### 🐛 Bug Fixes

- **Auto-Sync Loading State**: Fixed missing spinner during auto-sync on app launch
  - Expense store now sets `isLoading: true` before starting auto-sync
  - Loading state properly cleared after sync completes (success or failure)
  - Users will now see loading indicator when app launches with auto-sync enabled

### 🔧 Technical Fixes

- **TypeScript Issues**: Fixed all TypeScript errors in test files
  - Added missing `smsImportSettings` field to all test fixtures and arbitraries
  - Updated test settings objects to use version 7
  - All 728 tests now passing

- **Translations**: Verified all SMS import UI strings use i18n translations
  - All user-facing strings properly internationalized
  - Translation keys added for: title, description, status messages, permission dialogs, and help text

### 📝 Notes

- This release represents a significant architectural shift to Android-only
- SMS import is the first step toward more advanced automation features
- Future versions may add notification listener support and auto-import bypass

---

**Full Changelog**: Compare with `main` branch for complete list of changes
