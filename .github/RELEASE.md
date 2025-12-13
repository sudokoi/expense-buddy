# Release Workflow

This document explains how to create releases and build APK files for the Expense Buddy app.

## Automatic Release (Tag Push)

To create a release automatically:

1. Create and push a tag:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. The workflow will:
   - Build the APK using EAS
   - Name it `expense-buddy-v1.0.0.apk`
   - Create a GitHub Release with the APK attached
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
   - Build the APK using EAS
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

## Notes

- Build time: Typically 10-20 minutes depending on EAS queue
- APK size: ~50-80 MB (varies based on dependencies)
- Artifacts are retained for 90 days
- Only tag pushes create GitHub Releases
