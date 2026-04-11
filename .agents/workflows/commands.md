---
description: development commands reference and guidelines
---

# Development Commands

This document defines the standard commands to use when working on this project.

## Testing

```bash
# Run all tests
yarn test

# Run tests in watch mode (for development)
yarn test:watch

# Run a specific test file
yarn test <path-to-test-file>

# Run tests matching a pattern
yarn test --testNamePattern="<pattern>"
```

## Linting

```bash
# Check for linting errors
yarn lint

# Fix linting errors automatically
yarn lint:fix
```

## Type Checking

```bash
# Run TypeScript type checking
yarn tsc --noEmit
```

## Formatting

```bash
# Format all files
yarn format

# Check formatting without making changes
yarn format:check
```

## Development Server

```bash
# Start Expo development server (clears cache)
yarn start

# Start for Android
yarn android

# Start for iOS
yarn ios

# Start for web
yarn web
```

## Changesets (for versioning)

```bash
# Create a new changeset
yarn changeset

# Apply changesets and bump versions
yarn changeset:version

# Check changeset status
yarn changeset:status
```

## Tamagui

```bash
# Check Tamagui configuration
yarn check:tamagui

# Upgrade Tamagui to latest
yarn upgrade:tamagui

# Upgrade Tamagui to canary
yarn upgrade:tamagui:canary
```

## Important Notes

- Always use `yarn test` instead of `npx jest` for consistency
- When running specific test files, use `yarn test <file>` not `npx jest <file>`
- For property-based tests, the default 100 iterations is configured in the test files

## Post-Implementation Checklist

When completing an implementation task or feature:

1. **Run linting** to catch code quality issues:

   ```bash
   yarn lint:fix
   ```

2. **Run typecheck** to catch type errors:

   ```bash
   yarn tsc --noEmit
   ```

3. **Run formatting** to ensure consistent code style:

   ```bash
   yarn format
   ```

4. **Run all tests** to ensure nothing is broken:
   ```bash
   yarn test
   ```

Always run these four commands before considering an implementation complete.

## Code Quality Requirements

**All lint errors AND warnings must be fixed before completing any task.**

- Do not leave any ESLint warnings unresolved
- Common warnings to watch for:
  - `react-hooks/exhaustive-deps` - Missing dependencies in useEffect/useCallback/useMemo
  - Unused variables or imports
  - Missing return types
- Use `useCallback` to wrap functions used in dependency arrays
- Use `useMemo` for expensive computations that are dependencies
- If a warning cannot be fixed, document why with an eslint-disable comment (rare cases only)
