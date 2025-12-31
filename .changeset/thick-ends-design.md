---
"expense-buddy": patch
---

Optimize category and payment method selection responsiveness

- Replace slow "bouncy" animations with "quick" across selection components
- Memoize CategoryCard and PaymentMethodCard to prevent unnecessary re-renders
- Add useCallback for selection handlers in add/edit flows
- Remove unnecessary animations from static display cards
