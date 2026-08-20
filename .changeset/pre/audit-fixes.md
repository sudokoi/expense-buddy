---
"expense-buddy": patch
---

Audit fixes: theme, filters, a11y and Kotlin hygiene

- Deepen theme into single source (`palette.ts` owns `DESTRUCTIVE`/`KAWAII`, `check:theme` validates `palette` ↔ `global.css` ↔ `tailwind` ↔ `app.config`)
- Unify filter chips via `FilterChipBar`/`FilterChip` and `Button variant="accent"` (no inline `style`)
- Harden layers: remove `stores→providers` re-export, parallelize store init, enforce `44dp` targets and `ci` theme check
