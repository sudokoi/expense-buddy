# Android Platform Configuration

## Overview

Expense Buddy is now **Android-only** to leverage the SMS and notification import features that require Android-specific permissions and APIs.

## Minimum Requirements

### Android Version

- **Minimum SDK:** API 34 (Android 14)
- **Target SDK:** API 35 (Android 15)
- **Compile SDK:** API 35

### Device Types

- ✅ Android smartphones
- ✅ Android tablets
- ❌ iOS devices (iPhone, iPad)
- ❌ Web browsers

## Why Android 14+?

The SMS import feature requires several Android APIs that work best on Android 14 (API 34) and above:

1. **SMS Library Compatibility** - `@maniac-tech/react-native-expo-read-sms` requires API 34+
2. **Modern Permissions** - Enhanced READ_SMS and RECEIVE_SMS permission handling
3. **Notification Listener** - Improved notification access service with better privacy controls
4. **Background Execution** - Optimized background service support for SMS monitoring
5. **Security** - Latest permission models and security features

## Supported Devices

### Fully Supported

- Samsung Galaxy S21 and newer (Android 14+)
- Google Pixel 6 and newer (Android 14+)
- OnePlus 11 and newer (Android 14+)
- Xiaomi 13 and newer (Android 14+)
- Any Android 14+ device with Google Play Services

### Not Supported

- Android devices below API 34 (Android 13 and older)
- iOS devices (iPhone, iPad)
- Web browsers
- Android emulators without Google Play Services

## Required Permissions

The app requires the following Android permissions:

### SMS Access

- `android.permission.READ_SMS` - Read incoming SMS messages
- `android.permission.RECEIVE_SMS` - Receive SMS broadcast events

### Notifications

- `android.permission.BIND_NOTIFICATION_LISTENER_SERVICE` - Access notification content
- `android.permission.POST_NOTIFICATIONS` - Show import notifications

### Storage

- `android.permission.READ_EXTERNAL_STORAGE` - Access to export/import CSV files
- `android.permission.WRITE_EXTERNAL_STORAGE` - Write CSV exports

## Installation

### Google Play Store

The app will only be available for Android devices running Android 14 or higher.

### Manual Installation (APK)

Download the APK from the releases page. The app will check for minimum SDK version at startup and show an error if your device is not supported.

## Development

### Prerequisites

- Android Studio Iguana (2023.2.1) or newer
- Android SDK Platform 35
- Android Virtual Device (AVD) with API 34+
- JDK 17 or newer

### Building

```bash
# Install dependencies
yarn install

# Run on Android device/emulator
yarn android

# Build production APK
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

### Testing

Use an Android emulator with API 34 or higher for development. The app will not build or run on iOS simulators or web browsers.

## Troubleshooting

### "App not compatible with your device"

Your Android device is running a version older than Android 14. The SMS import features require Android 14 or higher.

### SMS permissions not working

- Ensure your device has a SIM card installed
- Check that Google Messages or another SMS app is set as default
- Grant SMS permissions when prompted during first setup

### Notifications not importing

- Enable notification access in Settings > Apps > Expense Buddy > Notification access
- Ensure banking apps are allowed to show notifications
- Check that "Do Not Disturb" mode is off

## Migration from Cross-Platform

If you were using Expense Buddy on iOS or web previously:

1. **Export your data** from the old platform
2. **Install on Android** device running Android 14+
3. **Import your data** using the CSV import feature
4. **Enable SMS import** in Settings > SMS Import

## Technical Details

### Architecture

- **New Architecture Enabled:** Yes (Bridgeless mode)
- **Hermes Engine:** Enabled
- **ProGuard:** Enabled for release builds
- **Minification:** Enabled for release builds

### Dependencies

Key Android-specific dependencies:

- `@maniac-tech/react-native-expo-read-sms` - SMS reading functionality
- `expo-notifications` - Notification handling
- `react-native-device-info` - Device information

### Build Configuration

- **Gradle Plugin:** 8.0+
- **NDK:** Not required
- **CMake:** Not required

## Future Considerations

As Android evolves, we may increase the minimum SDK version to leverage newer APIs:

- Android 15 (API 35) - Enhanced security and privacy features
- Android 16 (API 36) - Latest APIs when available

The app currently requires Android 14+ and will maintain compatibility with modern Android versions.
