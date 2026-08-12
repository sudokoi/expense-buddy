---
"expense-buddy": patch
---

Fix SMS notification deep link, i18n bugs, and code quality improvements

- Fix SMS notification not opening the import review screen — the deep link
  passes the item's fingerprint but the review screen was matching by id only
- Fix raw i18n key displayed as placeholder text in payment instrument dropdown
  (`settings.instruments.form.identifierPlaceholder` → `instruments.form.identifierPlaceholder`)
- Fix hardcoded `(Optional)` text replaced with `t("common.optional")` for locale support
- Fix SMS category fallback being locale-dependent — compare canonical `"Other"`
  string instead of translated label to avoid silent mismatches on non-English locales
- Add 7 missing i18n keys across all 5 locales (`common.required`,
  `history.editDialog.notFound`, `instruments.remove`, and 4 validation keys)
- Remove 36 unused i18n keys that had no code references
- Improve type safety: `_event: any` → `DateTimePickerEvent`, `useRef<any>` → `ElementRef`
- Memoize `onChangeDate` callback and use functional setter to avoid stale closures
- Replace array index with stable `chip.label` as React key in filter chip lists
