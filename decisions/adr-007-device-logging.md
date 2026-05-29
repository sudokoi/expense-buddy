# ADR-007: On-Device Structured Logging with Room-Backed Ring Buffer

**Date:** 2026-05-27
**Status:** Accepted

---

## Context

The SMS import system spans JS and native layers, including a `BroadcastReceiver` that runs outside the React Native lifecycle. Debugging issues like duplicate queue entries, missed fingerprints, or background receiver crashes currently relies on scattered `console.warn` calls and silent `catch` blocks. The project has no centralized logging, no crash reporting, and no way to inspect what happened on-device after the fact.

Key drivers:

- **Background operations are invisible**: The `SMS_RECEIVED` receiver, Room repository operations, and native module API calls have no structured log trail.
- **Silent error swallowing**: Several native module wrappers use bare `catch {}` blocks that discard errors.
- **No cross-layer traceability**: A single user action (e.g., "scan SMS") flows through XState store, service module, TurboModule bridge, and native repository. Errors at any layer are logged independently — or not at all.
- **Bug reports lack context**: The current "Report an Issue" button opens a blank GitHub issue. Users rarely provide enough detail to reproduce problems.

A lightweight, local-only logging system addresses these gaps without introducing network calls or external services.

## Decision

Create a dedicated native Expo module (`expense-buddy-logger`) backed by a Room database with auto-pruning, and expose it to both JS and other native modules through a single API surface.

### Module architecture

```
expense-buddy-logger/
├── android/
│   └── src/main/java/expo/modules/expensebudgetlogger/
│       ├── LogEntity.kt                   # Room entity
│       ├── LogDao.kt                      # Room DAO
│       ├── LoggerDatabase.kt              # Room database
│       ├── LoggerApi.kt                   # Public singleton API for native callers
│       └── ExpenseBuddyLoggerModule.kt     # Expo Module definition
├── src/
│   ├── ExpenseBuddyLoggerModule.ts         # Native module loader
│   └── ExpenseBuddyLogger.types.ts         # TypeScript types
├── index.ts
├── expo-module.config.json
└── android/build.gradle
```

**Log capacity**: 1000 entries. After each insert, if the row count exceeds capacity, the oldest excess entries are deleted in the same transaction. This keeps disk usage bounded and predictable.

**`LoggerApi`** is a Kotlin `object` singleton that:

1. Initializes in `ExpenseBuddyLoggerModule.OnCreate` using `appContext.reactContext.applicationContext`
2. Builds the Room database and launches a `SupervisorJob() + Dispatchers.IO` coroutine scope
3. Provides fire-and-forget convenience methods: `LoggerApi.d(tag, msg)`, `.i(...)`, `.w(...)`, `.e(tag, msg, throwable?)`
4. The convenience methods launch a coroutine that inserts into Room and prunes — callers from any Kotlin class (receiver, repository, module) do not need a coroutine context

**TurboModule API** (for JS):

| Function                                     | Returns      | Description               |
| -------------------------------------------- | ------------ | ------------------------- |
| `logAsync(level, tag, message, stacktrace?)` | `void`       | Write a log entry         |
| `getLogsAsync(count)`                        | `LogEntry[]` | Last N entries            |
| `getLogsAsStringAsync(count)`                | `string`     | Formatted for bug reports |
| `clearLogsAsync()`                           | `void`       | Clear all logs            |

### JS integration

`services/logger.ts` wraps the native module with platform guards (no-op on iOS/web) and optionally patches `console.warn` / `console.error` at import time to route through `logAsync`.

### Cross-module dependency

Other native modules add to their `build.gradle`:

```groovy
dependencies {
    implementation project(":expense-buddy-logger")
}
```

Since Expo autolinking registers all modules as Gradle projects in the same build via `useExpoModules()`, `project()` notation resolves correctly. The consuming module can then call `LoggerApi.i(...)` directly.

### Bug report integration

The "Report an Issue" button in Settings is modified to:

1. Show an `Alert.alert` confirmation dialog:
   - Title: "Include Device Logs?"
   - Message: "The last 200 device logs will be attached to help debug the issue. These contain app operation details only — no SMS content, financial data, or personal information."
   - Buttons: [Cancel] [Continue to GitHub]
2. On "Continue": calls `getLogsAsStringAsync(200)`, encodes the result into the GitHub new-issue URL's `body` parameter, opens via `Linking.openURL`
3. On "Cancel": opens GitHub issues without logs (current behavior)

### Privacy

- Logs contain only app operation metadata: function names, error types, timestamps, tags
- No raw SMS content, financial amounts, passwords, or personal data is logged
- Logs never leave the device unless the user voluntarily reports a bug and confirms the sharing dialog
- The privacy policy is updated to describe this system

## Consequences

### Positive

- Unified log source across JS stores, native module APIs, and the background receiver
- Logs survive JS thread crashes and app restarts (Room-backed persistence)
- Auto-pruning prevents unbounded storage growth
- User controls sharing via explicit consent dialog
- Fire-and-forget API means existing Kotlin code can add logging with one line — no async plumbing
- Replaces silent `catch {}` with visible error trails
- No external logging service — aligns with existing privacy-first posture

### Negative

- Adds a new native module and Room dependency (APK size increase ~100 KB)
- Logs consume local storage up to the configured capacity (~500 KB for 1000 entries)
- Privacy documentation must be updated
- Console monkey-patch may add trivial overhead to every warn/error call

## Rejected alternatives

1. **JS-only ring buffer** — Store logs in a JS array with AsyncStorage persistence. Rejected because logs are lost on JS thread crashes, and the background receiver cannot log without the bridge being up.

2. **Single shared Room database** — Add a `logs` table to the existing Room database in `expense-buddy-sms-module`. Rejected because it couples logging to the SMS module and creates a cross-module dependency in the wrong direction (SMS module would be a logging dependency for other modules).

3. **Android Logcat only** — Use `android.util.Log` for native logging and `console.log` for JS. Rejected because logcat is not accessible to end users, is lost on device reboot, and cannot be attached to bug reports without adb.

4. **Third-party crash reporter (Sentry, Crashlytics)** — Rejected because it contradicts the app's privacy-first stance: no analytics or crash reporting SDKs are used anywhere in the project, and introducing one for logging alone is disproportionate.

## Related

- ADR-006: Native-owned SMS review queue (primary consumer of logging)
- PRIVACY.md: Updated to describe device logging
