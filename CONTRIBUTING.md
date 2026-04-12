# Contributing

Thanks for taking the time to contribute.

This project is intentionally opinionated about incoming contributions. The goal is to keep the codebase focused, avoid speculative work, and avoid low-signal AI-generated churn.

## When To Contribute

Contributions are a good fit when they do one of the following:

- fix a confirmed bug
- implement a feature that has already been discussed and accepted
- improve tests or documentation for an already accepted change
- make a focused refactor that is directly tied to a real, discussed problem

Contributions are not a good fit when they are:

- speculative features without a confirmed need
- broad cleanup, formatting, or folder-reorganization PRs without product or maintenance value
- architecture changes that have not been discussed first
- generated "AI slop" that adds bulk without clear reasoning, verification, or ownership
- drive-by rewrites that do not solve a concrete problem

Unless a maintainer explicitly asked for the change, open an issue first and discuss it before writing code.

## Issue-First Policy

Before opening a pull request, open an issue and discuss:

- the problem
- why it matters
- the proposed solution
- scope, tradeoffs, and affected areas

Wait for maintainer feedback before investing in implementation.

Pull requests that skip this step may be closed without review.

Use the existing GitHub issue templates when possible:

- bug report for defects and regressions
- feature request for new behavior or product changes

## How To Contribute

1. Open or find an issue first.
2. Confirm the problem and proposed solution with the maintainer.
3. Fork the repository and create a focused branch.
4. Make the smallest change that fully solves the agreed problem.
5. Add or update tests when behavior changes.
6. Update docs when user-visible behavior, architecture, or workflows change.
7. Run the relevant checks locally.
8. If the change should appear in release notes, add a changeset.
9. Open a pull request that links the issue and explains the change clearly.

## Local Checks

Run the checks that match your change. For most code changes, that means:

```bash
yarn test
yarn typecheck
yarn lint
```

Useful additional checks:

```bash
yarn check:translations
yarn format:check
```

If your contribution changes release-note-worthy behavior, also run:

```bash
yarn changeset
```

See [.changeset/README.md](./.changeset/README.md) for the release workflow details.

## Pull Request Expectations

Keep pull requests focused and easy to review.

- link the issue being addressed
- explain the problem first, then the chosen solution
- avoid unrelated edits in the same PR
- keep naming, architecture, and scope consistent with the existing codebase
- do not include generated code or text you cannot explain and maintain yourself

If you used AI assistance, you are still responsible for the result. Review it, verify it, and trim anything that does not earn its place.

## Copyright And Licensing

This project does not require copyright assignment or copyright transfer for contributions.

By submitting a contribution, you confirm that:

- you have the right to contribute the submitted work
- the contribution is your own work or you have permission to submit it
- the project may distribute the contribution under the repository license

The project license is [AGPL-3.0-only](./LICENSE).
