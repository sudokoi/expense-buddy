#!/usr/bin/env bash
set -euo pipefail

profile="${1:?Expected EAS profile}"
output="${2:?Expected artifact output path}"
case "$profile" in internal|production) ;; *) echo "Unsupported build profile" >&2; exit 2 ;; esac
: "${RUNNER_TEMP:?This script requires a GitHub runner}"
export EAS_LOCAL_BUILD_WORKINGDIR="$RUNNER_TEMP/expense-buddy-eas-$profile"
export EAS_LOCAL_BUILD_SKIP_CLEANUP=1
diagnostics="$RUNNER_TEMP/expense-buddy-diagnostics-$profile"
mkdir -p "$diagnostics"
{
  nproc
  free -h
  df -h "$RUNNER_TEMP"
  java -version
} > "$diagnostics/runner.txt" 2>&1

# Record process names and sizes, never arguments/environment/signing material.
(
  while true; do
    date -u +%FT%TZ
    free -m
    ps -eo pid,ppid,rss,comm --sort=-rss | head -n 21 || true
    sleep 5
  done
) > "$diagnostics/memory.txt" &
sampler=$!
finish() {
  kill "$sampler" 2>/dev/null || true
  wait "$sampler" 2>/dev/null || true
  # Export only the effective budget, not arbitrary Gradle properties/secrets.
  find "$EAS_LOCAL_BUILD_WORKINGDIR" -path '*/android/gradle.properties' -type f \
    -exec grep -E '^(org.gradle.(jvmargs|workers.max|parallel|caching)|kotlin.daemon.jvmargs)=' {} \; \
    > "$diagnostics/gradle-budget.txt" 2>/dev/null || true
}
trap finish EXIT
eas build --platform android --profile "$profile" --local --non-interactive --output="$output"
