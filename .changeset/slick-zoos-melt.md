---
"expense-buddy": patch
---

Improve regex SMS import accuracy across supported regions

- Distinguish debits from failed, future, requested, and OTP transactions; tolerate security footers and Unicode formatting.
- Validate amounts and explicit currencies, improve merchant/category/payment hints, and preserve existing review decisions when parsing changes.
- Add a documented multi-region regression corpus and parser, suggestion, and deduplication coverage.
