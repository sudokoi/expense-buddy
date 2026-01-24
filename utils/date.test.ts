import { getLocalDayKey, formatDate } from "./date"
import i18next from "i18next"

// Mock i18next
jest.mock("i18next", () => ({
  language: "en-US",
}))

describe("getLocalDayKey", () => {
  it("returns day key for date-only ISO", () => {
    expect(getLocalDayKey("2026-01-01")).toBe("2026-01-01")
  })

  it("handles midnight boundary", () => {
    expect(getLocalDayKey("2026-01-01T23:59:59")).toBe("2026-01-01")
    expect(getLocalDayKey("2026-01-02T00:00:00")).toBe("2026-01-02")
  })
})

describe("formatDate", () => {
  it("formats date with default locale (en-US)", () => {
    i18next.language = "en-US"
    expect(formatDate("2026-01-01", "MMMM d, yyyy")).toBe("January 1, 2026")
  })

  it("formats date with Hindi locale", () => {
    i18next.language = "hi"
    // In Hindi locale, January is जनवरी
    // But exact output depends on date-fns/locale/hi
    // Let's check generally or exact string if confident.
    // "जनवरी 1, 2026"
    expect(formatDate("2026-01-01", "MMMM d, yyyy")).toBe("जनवरी 1, 2026")
  })
})
