---
"expense-buddy": patch
---

Align Expo SDK dependencies and clear expo doctor warnings

- Bump seven Expo packages to their SDK 57 pinned patch versions (`expo install --fix`)
- Remove the `changeset` package.json script that shadowed the `changeset` binary in `node_modules/.bin`; `yarn changeset` still works via Yarn's binary fallback
