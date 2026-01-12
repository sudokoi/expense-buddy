// Only used for testing the version code computation logic.
// actual usage: see app.config.js

export type ComputeVersionCodeOptions = {
  /**
   * Whether to allow a leading `v` prefix (e.g. `v1.2.3`).
   * Defaults to true.
   */
  allowVPrefix?: boolean
}

/**
 * Computes a Play-Store-safe integer `versionCode` from a semver string.
 *
 * Encoding (9 digits total):
 *   MAJOR (2 digits) | MINOR (2 digits) | PATCH (2 digits) | SUFFIX (3 digits)
 *
 * Formula:
 *   MAJOR * 10,000,000 + MINOR * 100,000 + PATCH * 1,000 + SUFFIX
 *
 * SUFFIX:
 *   - Stable release: 999
 *   - Prerelease: STAGE * 100 + SEQ
 */
export function computeVersionCode(
  semverString: string,
  options: ComputeVersionCodeOptions = {}
): number {
  const raw = String(semverString).trim()
  const normalized = options.allowVPrefix === false ? raw : raw.replace(/^v/i, "")

  // Basic semver parser: MAJOR.MINOR.PATCH(-PRERELEASE)?(+BUILD)?
  const match = normalized.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/
  )

  if (!match) {
    throw new Error(
      `Invalid version: "${raw}" (expected semver like 1.2.3 or 1.2.3-beta.1)`
    )
  }

  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  const prerelease = match[4]
  const buildMeta = match[5]

  if (![major, minor, patch].every(Number.isInteger)) {
    throw new Error(`Invalid numeric semver parts in version: "${raw}"`)
  }

  if (minor < 0 || minor > 99 || patch < 0 || patch > 99) {
    throw new Error(
      `Unsupported semver for store versioning: "${raw}" (MINOR and PATCH must be 0-99)`
    )
  }

  const stageMap: Record<string, number> = {
    dev: 0,
    canary: 0,
    snapshot: 0,
    alpha: 1,
    a: 1,
    beta: 2,
    b: 2,
    rc: 3,
    pre: 4,
    preview: 4,
    prerelease: 5,
  }

  let suffix = 999

  if (prerelease) {
    const prereleaseParts = prerelease.split(".").filter(Boolean)
    const label = (prereleaseParts[0] || "").toLowerCase()
    const stage = Math.max(0, Math.min(8, stageMap[label] ?? 0))

    const numericFromPrerelease = prereleaseParts
      .slice(1)
      .find((part) => /^\d+$/.test(part))

    const numericFromBuildMeta = String(buildMeta || "")
      .split(".")
      .find((part) => /^\d+$/.test(part))

    const seqString = numericFromPrerelease ?? numericFromBuildMeta ?? "0"
    const seq = Number(seqString)

    if (!Number.isInteger(seq) || seq < 0 || seq > 99) {
      throw new Error(
        `Unsupported prerelease sequence in version: "${raw}" (sequence must be 0-99)`
      )
    }

    suffix = stage * 100 + seq
    if (suffix >= 999) {
      // Ensure stable release (999) always stays highest for the same MAJOR.MINOR.PATCH.
      suffix = 998
    }
  }

  const code = major * 10000000 + minor * 100000 + patch * 1000 + suffix

  if (!Number.isInteger(code) || code <= 0 || code >= 2100000000) {
    throw new Error(
      `Computed versionCode out of range for Android: ${code} (from version "${raw}")`
    )
  }

  return code
}
