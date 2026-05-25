---
"expense-buddy": patch
---

Extract inline styles from `.map()` loops to stable references to reduce per-render object allocations.

- Pre-build `selectedStyle` per category/method in `CategoryFilter` and `PaymentMethodFilter` useMemo caches
- Extract `borderRadius` constants to module-level layout style objects in `index.tsx`, `analytics.tsx`, `PaymentInstrumentsSection`
- Use `color` prop instead of inline style object in `NotificationStack`
- 6 files, 33 insertions, 17 deletions
