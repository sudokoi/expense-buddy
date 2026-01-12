const { version } = require("./package.json")

/**
 * Converts a semantic version string to a numeric version code for app stores.
 *
 * Requirements:
 *   - Must be a valid Android `versionCode` integer
 *   - Must be unique for every Play Store upload
 *   - Must support prereleases like `2.0.0-alpha.1`, `2.0.0-beta.3`, `2.0.0-rc.2`
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
 *     where STAGE is derived from the prerelease label (alpha/beta/rc/...) and SEQ is
 *     the first numeric identifier in the prerelease (e.g. alpha.12 → 12). If missing, SEQ=0.
 *
 * Examples:
 *   "1.12.2"         → 11202999
 *   "2.0.0-alpha.1"  → 20000101
 *   "2.0.0-beta.3"   → 20000203
 *   "2.0.0-rc.2"     → 20000302
 *   "v2.0.0"         → 20000999
 *
 * Constraints:
 *   - MINOR and PATCH must be 0-99 (two digits max)
 *   - `versionCode` must stay within Android int range (< 2,100,000,000)
 *
 * @see https://developer.android.com/studio/publish/versioning
 * @see https://developer.apple.com/documentation/bundleresources/information_property_list/cfbundleversion
 */
function computeVersionCode(semverString) {
  const raw = String(semverString).trim()
  const normalized = raw.replace(/^v/i, "")

  // Basic semver parser: MAJOR.MINOR.PATCH(-PRERELEASE)?(+BUILD)?
  const match = normalized.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/
  )

  if (!match) {
    throw new Error(
      `Invalid version in package.json: "${raw}" (expected semver like 1.2.3 or 1.2.3-beta.1)`
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

  const stageMap = {
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

const versionCode = computeVersionCode(version)

export default {
  expo: {
    name: "Expense Buddy",
    slug: "expense-buddy",
    version,
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#000000",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      buildNumber: String(versionCode),
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#000000",
      },
      package: "com.sudokoi.expensebuddy",
      versionCode,
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-build-properties",
        {
          ios: {
            newArchEnabled: true,
          },
          android: {
            newArchEnabled: true,
          },
        },
      ],
      "expo-web-browser",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "facbe508-0deb-4c1d-9625-b49b672a98f1",
      },
    },
    owner: "sudokoi",
  },
}
