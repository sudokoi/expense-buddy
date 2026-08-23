---
"expense-buddy": minor
---

Add Canada and Australia support with region-aware SMS import

- Add English (CA) and English (AU) locales sharing the en-GB translation bundle, plus CAD and AUD currencies
- Introduce an SMS import region setting (India / Canada / Australia) in the Localization settings group, seeded from the device locale on upgrade
- Changing the app language now also resets default currency and SMS region to match, with a confirmation prompt before applying
- Split the native parser into per-region rule packs with conservative first-pass patterns for Canadian banks (Interac e-Transfer, TD/RBC/Scotia alerts) and Australian banks (CBA/NAB/Westpac alerts, PayID/Osko/BPAY)
- Settings schema migrates to v10 automatically; existing users keep India-region behavior unchanged
