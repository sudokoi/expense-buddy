---
"expense-buddy": patch
---

Center pie chart labels, conditionally auto-scroll trend, reorder analytics and aggregate instrument chart by method

- Center pie chart inline labels radially between inner and outer radius to prevent clipping by the donut hole on the left side
- Only auto-scroll spending trend to the latest data when a window-based time filter is selected, not for month selectors
- Reorder analytics charts to show spending trend first, followed by category, payment method, and payment instrument
- Aggregate spend-by-payment-instrument pie slices by payment method (CC/DC/UPI) for distinct colors while keeping per-card breakdown in the legend below
- Use CC/DC short labels for credit/debit cards to prevent labels extending outside cards
