const fs = require("fs")
const os = require("os")
const path = require("path")
const { test, expect, beforeEach, afterEach, jest: jestApi } = require("@jest/globals")
const { checkNativeKeys } = require("./check-translations")

let root
let error
function writeResource(moduleName, folder, contents) {
  const directory = path.join(root, "modules", moduleName, "android/src/main/res", folder)
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(path.join(directory, "strings.xml"), contents)
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "expense-buddy-native-keys-"))
  error = jestApi.spyOn(console, "error").mockImplementation(() => {})
  for (const moduleName of ["expense-buddy-sms-module", "expense-buddy-widget"]) {
    for (const folder of ["values", "values-hi", "values-ja"]) {
      writeResource(
        moduleName,
        folder,
        '<resources><string name="title">Title</string><plurals name="count" /></resources>'
      )
    }
  }
})
afterEach(() => {
  error.mockRestore()
  fs.rmSync(root, { recursive: true, force: true })
})

test.each(["values-fr", "values-en-rGB", "values-b+zh+Hans+CN"])(
  "discovers and validates added native locale %s",
  (folder) => {
    writeResource(
      "expense-buddy-widget",
      folder,
      '<resources><string name="title">Titre</string></resources>'
    )
    expect(checkNativeKeys(root)).toBe(false)
    expect(error).toHaveBeenCalledWith(expect.stringContaining(folder))
    writeResource(
      "expense-buddy-widget",
      folder,
      '<resources><string name="title">Titre</string><plurals name="count" /></resources>'
    )
    expect(checkNativeKeys(root)).toBe(true)
  }
)

test("non-locale and version-specific resource overlays need not repeat all strings", () => {
  for (const folder of ["values-night", "values-v31", "values-car", "values-fr-v31"]) {
    writeResource("expense-buddy-widget", folder, "<resources />")
  }
  expect(checkNativeKeys(root)).toBe(true)
})
