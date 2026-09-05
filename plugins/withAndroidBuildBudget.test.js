const { applyBuildBudget } = require("./withAndroidBuildBudget")
const { test, expect } = require("@jest/globals")

test("replaces duplicate defaults without disturbing unrelated properties", () => {
  const unrelated = { type: "property", key: "hermesEnabled", value: "true" }
  const result = applyBuildBudget(
    [
      unrelated,
      { type: "comment", value: "Preserve this" },
      { type: "property", key: "org.gradle.jvmargs", value: "-Xmx2g" },
      { type: "property", key: "org.gradle.jvmargs", value: "-Xmx8g" },
    ],
    { CI: "true" }
  )
  expect(result).toContain(unrelated)
  expect(result.filter((entry) => entry.key === "org.gradle.jvmargs")).toEqual([
    {
      type: "property",
      key: "org.gradle.jvmargs",
      value: "-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8",
    },
  ])
  expect(applyBuildBudget(result, { CI: "true" })).toEqual(result)
  expect(result).toContainEqual({
    type: "property",
    key: "org.gradle.workers.max",
    value: "2",
  })
})

test("local prebuild preserves developer concurrency instead of imposing runner limits", () => {
  const concurrency = [
    { type: "property", key: "org.gradle.workers.max", value: "8" },
    { type: "property", key: "org.gradle.parallel", value: "true" },
  ]
  const result = applyBuildBudget(concurrency, {})
  expect(result).toEqual(expect.arrayContaining(concurrency))
  expect(applyBuildBudget([], {})).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ key: "org.gradle.workers.max" })])
  )
})

test.each([
  { CI: "true" },
  { CI: "1" },
  { EAS_BUILD: "true" },
  { EXPENSE_BUDDY_LIMIT_BUILD_CONCURRENCY: "1" },
])("runner or explicit opt-in applies the concurrency budget: %j", (environment) => {
  const result = applyBuildBudget([], environment)
  expect(result).toEqual(
    expect.arrayContaining([
      { type: "property", key: "org.gradle.workers.max", value: "2" },
      { type: "property", key: "org.gradle.parallel", value: "false" },
    ])
  )
})
