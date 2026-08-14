import { reconcileAfterSync } from "../sync-reconcile"
import { SyncQueueOp } from "../sync-queue"
import { Expense } from "../../types/expense"
import { AppSettings, DEFAULT_SETTINGS } from "../settings-manager"
import { Category } from "../../types/category"

function createExpense(id: string, note: string): Expense {
  const now = new Date().toISOString()
  return {
    id,
    amount: 12.34,
    category: "Food",
    note,
    date: "2025-01-01",
    paymentMethod: { type: "Cash" },
    createdAt: now,
    updatedAt: now,
  }
}

function createSettings(categories: Category[]): AppSettings {
  return { ...DEFAULT_SETTINGS, categories }
}

function op(type: SyncQueueOp["type"], id: number, data: Partial<SyncQueueOp> = {}): SyncQueueOp {
  return { id, timestamp: new Date().toISOString(), type, ...data } as SyncQueueOp
}

describe("reconcileAfterSync", () => {
  it("replays queued expense ops on top of the merge base", () => {
    const base = [createExpense("1", "Base")]
    const added = createExpense("2", "Added")

    const result = reconcileAfterSync({
      baseExpenses: base,
      settings: createSettings([]),
      opsAfter: [
        op("expense.upsert", 1, { expense: { ...base[0], note: "Updated" } }),
        op("expense.upsert", 2, { expense: added }),
      ],
    })

    expect(result.expenses.find((e) => e.id === "1")?.note).toBe("Updated")
    expect(result.expenses.find((e) => e.id === "2")?.note).toBe("Added")
    expect(result.hasPendingExpenseOps).toBe(true)
    expect(result.hasPendingSettingsOps).toBe(false)
  })

  it("flags pending settings ops for category changes", () => {
    const result = reconcileAfterSync({
      baseExpenses: [],
      settings: createSettings([]),
      opsAfter: [
        op("category.add", 1, {
          category: {
            label: "Travel",
            icon: "plane",
            color: "#123",
            order: 0,
            isDefault: false,
            updatedAt: new Date().toISOString(),
          },
        }),
      ],
    })

    expect(result.hasPendingSettingsOps).toBe(true)
    expect(result.hasPendingExpenseOps).toBe(false)
  })

  it("prefers fully merged settings over the merged-categories fallback", () => {
    const food: Category = {
      label: "Food",
      icon: "utensils",
      color: "#fff",
      order: 0,
      isDefault: true,
      updatedAt: new Date().toISOString(),
    }
    const mergedSettings = { ...DEFAULT_SETTINGS, theme: "dark" as const, categories: [food] }

    const result = reconcileAfterSync({
      baseExpenses: [],
      settings: createSettings([food]),
      mergedSettings,
      mergedCategories: [food],
      opsAfter: [],
    })

    expect(result.settings.theme).toBe("dark")
  })

  it("falls back to merged categories when settings did not fully sync", () => {
    const food: Category = {
      label: "Food",
      icon: "utensils",
      color: "#fff",
      order: 0,
      isDefault: true,
      updatedAt: new Date().toISOString(),
    }
    const travel: Category = {
      label: "Travel",
      icon: "plane",
      color: "#123",
      order: 1,
      isDefault: false,
      updatedAt: new Date().toISOString(),
    }

    const result = reconcileAfterSync({
      baseExpenses: [],
      settings: createSettings([food]),
      mergedCategories: [food, travel],
      opsAfter: [],
    })

    expect(result.settings.categories.map((c) => c.label)).toEqual(["Food", "Travel"])
  })
})
