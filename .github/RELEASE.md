# Release Workflow

This document explains how releases are automated for the Expense Buddy app.

## Automated Release Flow

The release process is fully automated using GitHub Actions and Changesets:

```
PR merged → Changeset Action → Version PR created → Version PR merged → Tag pushed → APK built → GitHub Release created
```

### How It Works

1. **During Development**: Contributors add changesets with `yarn changeset`
2. **On PR Merge**: The Changeset Action detects pending changesets and creates a "Version Packages" PR
3. **Version PR**: Contains version bump in `package.json` and updated `CHANGELOG.md`
4. **On Version PR Merge**: The Changeset Action automatically pushes a git tag (e.g., `v1.4.0`)
5. **On Tag Push**: The Release workflow builds an APK and creates a GitHub Release

### Workflows

| Workflow        | Trigger         | Purpose                               |
| --------------- | --------------- | ------------------------------------- |
| `changeset.yml` | Push to `main`  | Creates version PRs and pushes tags   |
| `release.yml`   | Tag push (`v*`) | Builds APK and creates GitHub Release |
| `ci.yml`        | PR to `main`    | Runs lint, format, and tests          |

## For Contributors

### Step 1: Document Your Changes

As you work, document your changes using Changesets:

```bash
# Add a changeset for your changes
yarn changeset

# Check what changesets are pending
yarn changeset:status
```

Follow the prompts to describe your changes. This creates a markdown file in `.changeset/` directory.

### Step 2: Commit and Push

Commit your changesets along with your code:

```bash
git add .changeset
git commit -m "feat: add new feature"
git push origin my-feature-branch
```

### Step 3: Create a Pull Request

Open a PR to `main`. The CI workflow will run lint, format, and tests.

### Step 4: Merge and Wait

After your PR is merged:

1. The Changeset Action creates a "Version Packages" PR (if changesets exist)
2. A maintainer reviews and merges the Version PR
3. A tag is automatically pushed
4. The Release workflow builds and publishes the APK
5. A comment is added to the merged PR with the release link

## Changeset Types

Select the appropriate change type when running `yarn changeset`:

| Type    | When to Use                             | Version Bump  |
| ------- | --------------------------------------- | ------------- |
| `patch` | Bug fixes, styling fixes, documentation | 1.0.0 → 1.0.1 |
| `minor` | New features, new UI components         | 1.0.0 → 1.1.0 |
| `major` | Breaking changes, major rewrites        | 1.0.0 → 2.0.0 |

### Example Changeset

```markdown
---
"expense-buddy": minor
---

### Features

- Add reusable UI components for consistent styling
- Implement token-based theming with getColorValue helper

### Bug Fixes

- Fix background color issues in add/edit screens
```

## Manual Release (Workflow Dispatch)

To manually trigger a build without going through the changeset flow:

1. Go to **Actions** → **Build and Release APK** → **Run workflow**
2. Choose options:
   - **Branch**: Select the branch to build from
   - **Version suffix**: Custom name or leave empty for commit SHA
3. The APK will be uploaded as a workflow artifact (no GitHub Release created)

## Downloading the APK

### From GitHub Release (Recommended)

1. Go to **Releases** in the repository
2. Find your release version
3. Download the APK from the Assets section

### From Workflow Artifacts

1. Go to **Actions** → **Build and Release APK**
2. Click on the workflow run
3. Scroll down to **Artifacts**
4. Download the APK zip file

## Prerequisites

The following secrets must be configured in the repository:

| Secret         | Purpose                                                 |
| -------------- | ------------------------------------------------------- |
| `EXPO_TOKEN`   | Expo access token for EAS builds                        |
| `GH_PAT`       | Personal Access Token for pushing tags and creating PRs |
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions                |

## Build Configuration

The release workflow uses the `internal` build profile from `eas.json`:

- **Distribution**: Internal
- **Build type**: APK (not AAB)
- **Use case**: Testing and distribution outside of Play Store

## Notes

- Build time: Typically 10-20 minutes depending on EAS cloud queue
- APK size: ~50-80 MB (varies based on dependencies)
- Artifacts are retained for 90 days
- Workflow timeout: 45 minutes
- Always create changesets for user-facing changes
- The Version PR must be merged by a maintainer to trigger the release
