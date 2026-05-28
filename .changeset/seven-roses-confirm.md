---
"expense-buddy": patch
---

Extract SMS parsing logic from JS to native SmsMessageParser, eliminating duplicate regex parsing

- Move all regex patterns (amount, merchant, category, payment method, OTP, negative-alert filters)
  and fingerprint hashing from JS parser.ts/fingerprint.ts into native SmsMessageParser in
  expense-buddy-sms-import module
- BackgroundSmsParser now delegates to SmsMessageParser, keeping only Android SmsMessage[]
  to raw-string conversion
- Add scanAndParseMessagesAsync to ExpenseBuddySmsImportModule: scans SMS and returns
  pre-parsed results with native fingerprints in one call
- Simplify bootstrap.ts: calls scanAndParseMessages instead of JS parser + fingerprint
- Delete parser.ts, parser.test.ts, fingerprint.ts, fingerprint.test.ts
- payment-method-hints.ts kept for suggestion-resolver.ts (downstream payment instrument matching)
- Add 30 Kotlin tests in SmsMessageParserTest (replaces 9 JS parser + 7 JS fingerprint tests)
- Update ARCHITECTURE.md and ADR-006 to reflect unified native parser
