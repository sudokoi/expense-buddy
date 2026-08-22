/**
 * Expo config plugin: themed adaptive-icon background.
 *
 * Stock Expo only writes a single `iconBackground` color
 * (android/app/src/main/res/values/colors.xml) from
 * `android.adaptiveIcon.backgroundColor`. That means the launcher
 * icon background is the same in light and dark mode — it flashes
 * the wrong color when the system theme differs from the app theme.
 *
 * This plugin keeps the light value in `values/colors.xml` (handled by
 * Expo) and writes the dark value to `values-night/colors.xml`, so the
 * system picks `@color/iconBackground` per night qualifier.
 *
 * Colors mirror constants/palette.ts — keep them in sync.
 */

const { withAndroidColors, withAndroidColorsNight } = require("@expo/config-plugins")

const LIGHT_BG = "#FFF8F0"
const DARK_BG = "#1D161B"

function withThemedIconBackground(config) {
  // Light — explicit so the invariant is visible even if Expo's
  // own withAndroidAdaptiveIconColors changes.
  config = withAndroidColors(config, (config) => {
    const { Colors } = require("@expo/config-plugins/build/android")
    config.modResults = Colors.assignColorValue(config.modResults, {
      name: "iconBackground",
      value: LIGHT_BG,
    })
    return config
  })

  // Dark — night qualifier; Android picks this when uiMode is night.
  config = withAndroidColorsNight(config, (config) => {
    const { Colors } = require("@expo/config-plugins/build/android")
    config.modResults = Colors.assignColorValue(config.modResults, {
      name: "iconBackground",
      value: DARK_BG,
    })
    return config
  })

  return config
}

module.exports = withThemedIconBackground
module.exports.default = withThemedIconBackground
