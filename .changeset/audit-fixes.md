---
"expense-buddy": patch
---

Audit fixes: unify filter chip theming and architecture hygiene

- Replace inline `style` accent overrides in analytics filter chips with `variant="accent"` to use compiled Tailwind and remove manual `useThemeColors` theming in `CategoryFilter`, `PaymentMethodFilter`, `PaymentInstrumentFilter`, `TimeWindowSelector`, `MonthSelector`, `CurrencyFilter`
- Own orphan tokens in `palette.ts` — add `DESTRUCTIVE_COLOR` and `KAWAII_COLORS` so `global.css` vars are no longer CSS-only orphans
- Fix layer inversion: remove `stores/hooks.ts -> providers` re-export, update consumers to import `useSmsImportReview` directly from `providers/sms-import-review-provider`
- Parallelize store initialization after migration in `store-provider.tsx` (`Promise.all` for settings/expenses/uiState)
- Increase `IconActionButton` tap target to 44dp (`p-2` + `hitSlop={8}`) for accessibility
- Align native splash/adaptive icon to palette (`app.config.js` `#000000` → `#FFF8F0`), fix `docs/nativewind.md` borderRadius/content/colors example to match `palette.ts`/`tailwind.config.js`, clarify `UI_SPACE.gutter`→`p-5` mapping, and apply Kotlin hygiene: nullable `getTimeWindow` (no 1970 sentinel), `BackgroundSmsPreferences` post-write `getState` check, `SupervisorJob` scope + per-`goAsync` `CoroutineScope` in `ExpenseBuddySmsReceiver`
