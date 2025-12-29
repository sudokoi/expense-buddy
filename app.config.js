const { version } = require("./package.json")

/**
 * Converts a semantic version string to a numeric version code for app stores.
 *
 * Formula: MAJOR * 10000 + MINOR * 100 + PATCH
 *
 * Examples:
 *   "1.0.0"  → 10000
 *   "1.4.0"  → 10400
 *   "1.4.1"  → 10401
 *   "2.0.0"  → 20000
 *   "2.15.3" → 21503
 *
 * Constraints:
 *   - MINOR and PATCH must be 0-99 (two digits max)
 *   - Always increments as long as semver increments correctly
 *   - Used for Android versionCode and iOS buildNumber
 *
 * @see https://developer.android.com/studio/publish/versioning
 * @see https://developer.apple.com/documentation/bundleresources/information_property_list/cfbundleversion
 */
const [major, minor, patch] = version.split(".").map(Number)
const versionCode = major * 10000 + minor * 100 + patch

export default {
  expo: {
    name: "expense-buddy",
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
