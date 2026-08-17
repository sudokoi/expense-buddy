const { withProjectBuildGradle } = require("@expo/config-plugins")

/**
 * Expo config plugin that disables the Gradle 9+ `failOnNoDiscoveredTests`
 * check in the root android/build.gradle.
 *
 * Third-party React Native libraries can trigger "test sources present but no
 * tests discovered" errors because AGP adds android resource classes to the
 * test classpath even when the module has no unit tests.
 *
 * @see https://github.com/gradle/gradle/issues/33619
 */
function withDisableNoDiscoveredTests(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      const contents = config.modResults.contents

      if (contents.includes("failOnNoDiscoveredTests")) {
        return config
      }

      const snippet = [
        "",
        "  // [withDisableNoDiscoveredTests] Prevent build failure when test tasks",
        "  // discover no tests (common with third-party RN libraries on Gradle 9+).",
        "  tasks.withType(Test).configureEach {",
        "    failOnNoDiscoveredTests = false",
        "  }",
      ].join("\n")

      const allprojectsRegex = /(allprojects\s*\{[\s\S]*?)(\n\})/
      if (allprojectsRegex.test(contents)) {
        config.modResults.contents = contents.replace(allprojectsRegex, `$1${snippet}$2`)
      } else {
        config.modResults.contents = contents + "\n" + snippet + "\n"
      }
    }
    return config
  })
}

module.exports = withDisableNoDiscoveredTests
