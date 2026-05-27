#!/bin/bash
set -euo pipefail

KTLINT_VERSION="1.5.0"
KTLINT_JAR="ktlint-$KTLINT_VERSION.jar"
KTLINT_URL="https://github.com/pinterest/ktlint/releases/download/$KTLINT_VERSION/ktlint"
CACHE_DIR=".cache/ktlint"
CACHE_PATH="$CACHE_DIR/$KTLINT_JAR"

MODE="check"
if [ "${1:-}" = "--format" ]; then
  MODE="format"
fi

# Download ktlint if not cached
if [ ! -f "$CACHE_PATH" ]; then
  mkdir -p "$CACHE_DIR"
  echo "[lint-kotlin] Downloading ktlint $KTLINT_VERSION..."
  curl -sSLO "$KTLINT_URL" --output-dir "$CACHE_DIR"
  mv "$CACHE_DIR/ktlint" "$CACHE_PATH"
  chmod +x "$CACHE_PATH"
fi

# Find all Kotlin files outside generated directories
FILES=$(find modules -name '*.kt' -not -path '*/build/*' | tr '\n' ' ')

if [ -z "$FILES" ]; then
  echo "[lint-kotlin] No Kotlin files found"
  exit 0
fi

if [ "$MODE" = "format" ]; then
  echo "[lint-kotlin] Formatting Kotlin files..."
  "$CACHE_PATH" --format $FILES
else
  echo "[lint-kotlin] Running ktlint..."
  "$CACHE_PATH" $FILES
fi
