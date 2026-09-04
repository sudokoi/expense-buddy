import { buildWidgetAssist } from "./widget-assist"
import type { Expense } from "../types/expense"
import { DEFAULT_SETTINGS } from "./settings-manager"

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
})
