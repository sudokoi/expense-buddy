---
'expense-buddy': patch
---

Add on-device structured logging with Room-backed ring buffer and bug report integration

- Create new expense-buddy-logger native module with Room-backed log storage (auto-pruned to 1000 entries)
- Expose LoggerApi singleton for fire-and-forget logging from any Kotlin code
- Expose TurboModule API: logAsync, getLogsAsync, getLogsAsStringAsync, clearLogsAsync
- Patch console.warn/console.error to route through native logger
- Add structured logging to all native SMS module operations (SMS_MODULE, SMS_RECEIVER,
  SMS_QUEUE, SMS_PARSER, SMS_NOTIF, SMS_STORAGE)
- Replace silent catch{} blocks in JS module wrappers with error logging
- Update bug report button with confirmation dialog and optional log attachment to GitHub issue
