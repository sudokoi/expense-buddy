#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(dirname "$0")/.."
ANDROID_DIR="$PROJECT_DIR/android"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "==> android/ directory not found. Running expo prebuild..."
  cd "$PROJECT_DIR"
  npx expo prebuild --platform android --no-install --no-clean
fi

cd "$ANDROID_DIR"

echo "==> Running Kotlin unit tests for native modules..."
./gradlew testDebugUnitTest --continue "$@"
echo "==> Done."
