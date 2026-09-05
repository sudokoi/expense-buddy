#!/usr/bin/env bash
set -euo pipefail
if [[ "${GITHUB_REF:-}" == refs/tags/* ]]; then
  version="${GITHUB_REF#refs/tags/}"
else
  version="${VERSION_SUFFIX:-${GITHUB_SHA:0:7}}"
fi
if [[ ! "$version" =~ ^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$ ]]; then
  echo "Invalid build version: use a version or suffix without spaces or path separators" >&2
  exit 2
fi
{
  echo "version_name=$version"
  echo "version_no_v=${version#v}"
} >> "${GITHUB_OUTPUT:?Expected GitHub output file}"
