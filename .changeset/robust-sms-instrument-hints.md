---
"expense-buddy": patch
---

Improve SMS payment-instrument suggestions and Axis UPI parsing.

- Recognize account-number labels such as `A/c no.` and extract compact UPI/P2M merchants.
- Match saved instruments using distinctive two- or three-word nickname phrases when payer digits are absent.
- Preserve identifier priority and leave conflicting or ambiguous matches unselected, excluding recipient and support text from payer hints.
