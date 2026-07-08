---
"expense-buddy": patch
---

Stabilize the return values of `useExpenses` and `useSettings` by memoizing the wrapper objects. Previously both hooks returned a fresh object literal on every render, which broke referential stability for any child receiving them as props and invalidated dependent `useMemo`s on parent re-renders. The returned objects now only get a new identity when one of their selected slices actually changes.
