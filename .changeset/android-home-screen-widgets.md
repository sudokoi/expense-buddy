---
"expense-buddy": minor
---

Add Android home-screen widgets (Summary, 7-day Trend, Recent list)

- Three resizable widgets rendering natively from the on-device store: today/month totals with quick-add, last-7-day spending bars, and a recent-expenses list with per-widget category filter and hide-amounts privacy option.
- Widgets re-derive from live data on every system update (open, reboot, midnight rollover, 30-minute backstop) with a best-effort refresh right after in-app changes; see ADR-012.
