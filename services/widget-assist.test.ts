import { buildWidgetAssist } from "./widget-assist"
import type { Expense } from "../types/expense"
import { DEFAULT_SETTINGS } from "./settings-manager"

// Resolve t() against the real en-US bundle so the test verifies the
// single-source copy (keys exist, placeholders intact).
jest.mock("i18next", () => {
  const bundle = require("../locales/en-US/translation.json")
  const lookup = (key: string): string =>
    key.split(".").reduce<string | unknown>((node, part) => {
      if (typeof node === "object" && node !== null && part in node) {
        return (node as Record<string, unknown>)[part]
      }
      return key
    }, bundle) as string
  return { t: (key: string) => lookup(key) }
})

function expense(overrides: Partial<Expense> & { id: string }): Expense {
  return {
    amount: 100,
    category: "Food",
    date: "2026-09-04T05:00:00.000Z",
    note: "",
    createdAt: "2026-09-04T05:00:00.000Z",
    updatedAt: "2026-09-04T05:00:00.000Z",
    ...overrides,
  }
}

describe("buildWidgetAssist", () => {
  it("uses max updatedAt of active expenses as dataVersion", () => {
    const assist = buildWidgetAssist(
      [
        expense({ id: "a", updatedAt: "2026-09-02T00:00:00.000Z" }),
        expense({ id: "b", updatedAt: "2026-09-04T00:00:00.000Z" }),
        expense({
          id: "c",
          updatedAt: "2026-09-05T00:00:00.000Z",
          deletedAt: "2026-09-05T01:00:00.000Z",
        }),
      ],
      DEFAULT_SETTINGS,
      "INR"
    )
    expect(assist.dataVersion).toBe("2026-09-04T00:00:00.000Z")
  })

  it("falls back to settings default currency", () => {
    const assist = buildWidgetAssist([], DEFAULT_SETTINGS)
    expect(assist.currency).toBe(DEFAULT_SETTINGS.defaultCurrency)
  })

  it("carries category colors for widget dots", () => {
    const assist = buildWidgetAssist([], DEFAULT_SETTINGS, "INR")
    expect(assist.categoryColors["Food"]).toBeTruthy()
  })

  it("carries localized copy with native format placeholders", () => {
    const assist = buildWidgetAssist([], DEFAULT_SETTINGS, "INR")
    expect(assist.copy.today).toBeTruthy()
    expect(assist.copy.configSubtitle).toBeTruthy()
    expect(assist.copy.configCategory).toBe("Category")
    expect(assist.copy.expensesMany).toContain("%d")
    expect(assist.copy.expensesMany).not.toContain("{{count}}")
    expect(assist.copy.thisMonth).toContain("%s")
    expect(assist.copy.thisMonth).not.toContain("{{total}}")
  })
})
