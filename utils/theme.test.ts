/**
 * Unit tests for the theme-settled predicate used by the splash gate.
 */

import { isThemeSettled } from "./theme"

describe("isThemeSettled", () => {
  it("settles immediately when the preference is system", () => {
    expect(isThemeSettled("system", "light")).toBe(true)
    expect(isThemeSettled("system", "dark")).toBe(true)
  })

  it("is unsettled while a forced preference is not yet visible", () => {
    expect(isThemeSettled("light", "dark")).toBe(false)
    expect(isThemeSettled("dark", "light")).toBe(false)
  })

  it("settles once a forced preference is visible in the resolved scheme", () => {
    expect(isThemeSettled("light", "light")).toBe(true)
    expect(isThemeSettled("dark", "dark")).toBe(true)
  })
})
