---
"expense-buddy": patch
---

Fix theme-aware button contrast and export to direct file download

- Fix accent button text remaining `text-foreground` (`#F2E9EE` on `#FFB6C1`) by removing duplicate base in `buttonTextVariants` and deduping via `tailwind-merge`; all `variant="accent"` paths now correctly use `text-accent-foreground` (`#1D161B`) via single `palette` source.
- Restore category selection to show config colors only when selected (`resolveCategoryColor` + `getReadableTextColor`) with `theme.muted` otherwise, for both light and dark.
- Change CSV export from share-sheet-only to direct download to device storage (Storage Access Framework picker pre-filled with Downloads, `ExpenseBuddy` subfolder on document storage) with share-sheet fallback and `exportCancelled` handling via `hooks/use-export-action`.
