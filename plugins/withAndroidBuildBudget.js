const { withGradleProperties } = require("@expo/config-plugins")

// Heap/caching policy is shared. Only CI/EAS (or explicit local opt-in) limits
// concurrency; a heap limit alone is not a process RSS limit.
const BUILD_PROPERTIES = {
  "org.gradle.jvmargs": "-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8",
  "org.gradle.caching": "true",
  "kotlin.daemon.jvmargs": "-Xmx1g -XX:MaxMetaspaceSize=512m",
}

function applyBuildBudget(properties, environment = process.env) {
  const budget = { ...BUILD_PROPERTIES }
  const limitConcurrency =
    [environment.CI, environment.EAS_BUILD].some(
      (value) => value === "true" || value === "1"
    ) || environment.EXPENSE_BUDDY_LIMIT_BUILD_CONCURRENCY === "1"
  if (limitConcurrency) {
    budget["org.gradle.workers.max"] = "2"
    budget["org.gradle.parallel"] = "false"
  }
  return [
    ...properties.filter(
      (entry) => entry.type !== "property" || !Object.hasOwn(budget, entry.key)
    ),
    ...Object.entries(budget).map(([key, value]) => ({
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
