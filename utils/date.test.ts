import { getLocalDayKey } from "./date"

describe("getLocalDayKey", () => {
  it("returns day key for date-only ISO", () => {
    expect(getLocalDayKey("2026-01-01")).toBe("2026-01-01")
  })

  it("handles midnight boundary", () => {
    expect(getLocalDayKey("2026-01-01T23:59:59")).toBe("2026-01-01")
    expect(getLocalDayKey("2026-01-02T00:00:00")).toBe("2026-01-02")
  })
})
