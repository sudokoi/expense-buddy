---
description: verification steps after implementation
---

# Post-Implementation Verification

After completing any implementation work, always run the following verification steps:

// turbo-all

## 1. Type Check

```bash
npx tsc --noEmit
```

## 2. Lint

```bash
yarn lint:fix
```

## 3. Format

```bash
yarn format
```

## 4. Tests (if applicable)

```bash
yarn test
```
