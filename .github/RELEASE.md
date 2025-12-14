# Release Workflow

This document explains how to create releases and build APK files for the Expense Buddy app.

## Automatic Release (Tag Push)

### Step 1: Document Your Changes

As you work, document your changes using Changesets:

```bash
# Add a changeset for your changes
yarn changeset

# Check what changesets are pending
yarn changeset:status
```

Follow the prompts to describe your changes. This will create a markdown file in `.changeset/` directory.

Commit your changesets along with your code:

```bash
git add .changeset
git commit -m "Add changeset for feature X"
git push origin main
```

### Step 2: Version Bump and Generate Changelog

When ready to release, consume the changesets and generate the changelog:

```bash
# This will:
# - Update version in package.json
# - Generate/update CHANGELOG.md
# - Delete consumed changeset files
yarn changeset:version

# Review the changes
git diff

# Commit the version bump
git add .
git commit -m "Version bump to v1.1.0"
git push origin main
```

### Step 3: Create and Push a Tag

```bash
git tag v1.0.0
git push origin v1.0.0
```

### Step 4: Automated Build & Release

The workflow will automatically:

- Extract changelog from CHANGELOG.md for this version
- Trigger an EAS cloud build
- Wait for the build to complete (typically 10-20 minutes)
- Download the APK and name it `expense-buddy-v1.0.0.apk`
- Create a GitHub Release with:
  - The APK attached
  - Changelog from CHANGELOG.md
  - Auto-generated release notes from GitHub
- Upload the APK as a workflow artifact (retained for 90 days)

## Manual Build (Workflow Dispatch)

To manually trigger a build:

1. Go to **Actions** → **Build and Release APK** → **Run workflow**

2. Choose options:

   - **Branch**: Select the branch to build from
   - **Version suffix**:
     - Leave empty to use commit SHA (e.g., `expense-buddy-a1b2c3d.apk`)
     - Or enter a custom suffix (e.g., `beta-1` → `expense-buddy-beta-1.apk`)

3. The workflow will:
   - Trigger an EAS cloud build
   - Wait for the build to complete (typically 10-20 minutes)
   - Download the APK
   - Upload it as a workflow artifact (no GitHub Release created)

## Downloading the APK

### From GitHub Release (tag pushes only)

1. Go to **Releases** in the repository
2. Find your release version
3. Download the APK from the Assets section

### From Workflow Artifacts (all builds)

1. Go to **Actions** → **Build and Release APK**
2. Click on the workflow run
3. Scroll down to **Artifacts**
4. Download the APK zip file

## Prerequisites

Make sure the following secrets are configured in the repository:

- `EXPO_TOKEN`: Your Expo access token (required for EAS builds)
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

## Build Profile

The workflow uses the `internal` build profile from `eas.json`:

- Distribution: Internal
- Build type: APK (not AAB)
- Suitable for testing and distribution outside of Play Store

## Changelog Management

This project uses [Changesets](https://github.com/changesets/changesets) for changelog management.

### Creating a Changeset

```bash
yarn changeset
```

Select the change type:

- **patch**: Bug fixes (1.0.0 → 1.0.1)
- **minor**: New features (1.0.0 → 1.1.0)
- **major**: Breaking changes (1.0.0 → 2.0.0)

### Example Changeset

```markdown
---
"expense-buddy": minor
---

Added dark mode support and improved expense filtering
```

### Quick Release (Without Version Bump)

If you want to release without running `changeset:version`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Note: The release notes will only include changelog if CHANGELOG.md exists and has an entry for this version.

## Notes

- Build time: Typically 10-20 minutes depending on EAS cloud queue
- APK size: ~50-80 MB (varies based on dependencies)
- Artifacts are retained for 90 days
- Only tag pushes create GitHub Releases
- Builds use EAS cloud infrastructure (no local Android SDK required)
- Workflow timeout: 45 minutes (will fail if build takes longer)
- Changelog is extracted from CHANGELOG.md and included in release notes
- Always create changesets for user-facing changes
- Run `yarn changeset:version` before tagging to generate CHANGELOG.md
