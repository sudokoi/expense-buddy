const { applyBuildBudget } = require("./withAndroidBuildBudget")
const { test, expect } = require("@jest/globals")

test("replaces duplicate defaults without disturbing unrelated properties", () => {
  const unrelated = { type: "property", key: "hermesEnabled", value: "true" }
  const result = applyBuildBudget([
    unrelated,
    { type: "comment", value: "Preserve this" },
    { type: "property", key: "org.gradle.jvmargs", value: "-Xmx2g" },
    { type: "property", key: "org.gradle.jvmargs", value: "-Xmx8g" },
  ])
  expect(result).toContain(unrelated)
  expect(result.filter((entry) => entry.key === "org.gradle.jvmargs")).toEqual([
    {
      type: "property",
      key: "org.gradle.jvmargs",
      value: "-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8",
    },
  ])
  expect(applyBuildBudget(result)).toEqual(result)
  expect(result).toContainEqual({
    type: "property",
    key: "org.gradle.workers.max",
    value: "2",
  })
})
