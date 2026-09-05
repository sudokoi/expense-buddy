const { withGradleProperties } = require("@expo/config-plugins")

// One policy for prebuild, local EAS, and cloud EAS. Limit concurrent processes
// as well as individual heaps; a heap limit is not a process RSS limit.
const BUILD_PROPERTIES = {
  "org.gradle.jvmargs": "-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8",
  "org.gradle.workers.max": "2",
  "org.gradle.parallel": "false",
  "org.gradle.caching": "true",
  "kotlin.daemon.jvmargs": "-Xmx1g -XX:MaxMetaspaceSize=512m",
}

function applyBuildBudget(properties) {
  return [
    ...properties.filter(
      (entry) => entry.type !== "property" || !Object.hasOwn(BUILD_PROPERTIES, entry.key)
    ),
    ...Object.entries(BUILD_PROPERTIES).map(([key, value]) => ({
      type: "property",
      key,
      value,
    })),
  ]
}

module.exports = function withAndroidBuildBudget(config) {
  return withGradleProperties(config, (mod) => {
    mod.modResults = applyBuildBudget(mod.modResults)
    return mod
  })
}
module.exports.applyBuildBudget = applyBuildBudget
