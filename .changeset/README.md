# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs.

## Adding a Changeset

When you make changes that should be included in the release notes, create a changeset:

```bash
yarn changeset
```

This will prompt you to:

1. Select the type of change (patch/minor/major)
2. Write a summary of your changes

The changeset will be saved as a markdown file in `.changeset/` directory.

## Types of Changes

- **patch**: Bug fixes and minor updates (1.0.0 → 1.0.1)
- **minor**: New features, backwards compatible (1.0.0 → 1.1.0)
- **major**: Breaking changes (1.0.0 → 2.0.0)

## Example Changeset

```markdown
---
"expense-buddy": patch
---

Fixed expense calculation bug in monthly summary
```

## Workflow

### During Development

1. Make your code changes
2. Run `yarn changeset` to document the changes
3. Commit both your code and the changeset file
4. Push to the repository

```bash
git add .
git commit -m "Add feature X with changeset"
git push origin main
```

### When Ready to Release

1. **Consume changesets and generate changelog:**

```bash
yarn changeset:version
```

This will:

- Update version in package.json (based on changeset types)
- Generate/update CHANGELOG.md with all pending changes
- Delete consumed changeset files from `.changeset/`

2. **Review and commit the version bump:**

```bash
git diff  # Review the changes
git add .
git commit -m "Version bump to v1.1.0"
git push origin main
```

3. **Create and push a tag:**

```bash
git tag v1.1.0
git push origin v1.1.0
```

4. **GitHub Actions will automatically:**

- Extract the changelog for this version from CHANGELOG.md
- Build the APK
- Create a GitHub Release with the changelog

## Checking Status

To see pending changesets:

```bash
yarn changeset:status
```

This shows what version bump would occur and which changesets are pending.

## Important Notes

- **DO NOT** manually edit files in `.changeset/` (except this README)
- Changeset files are automatically deleted when you run `yarn changeset:version`
- The generated CHANGELOG.md is the source of truth for release notes
- Always run `yarn changeset:version` before creating a release tag
