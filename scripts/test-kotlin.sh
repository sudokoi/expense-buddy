#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(dirname "$0")/.."
cd "$PROJECT_DIR/android"

echo "==> Running Kotlin unit tests for native modules..."
./gradlew testDebugUnitTest --continue "$@"
echo "==> Done."
