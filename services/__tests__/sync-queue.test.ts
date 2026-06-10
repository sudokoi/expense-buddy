import { setItem, clear as clearStorage } from "../storage"
import {
  applyQueuedOpsToExpenses,
  applyQueuedOpsToSettings,
  enqueueSyncOp,
  getSyncOpsSince,
  getSyncQueueWatermark,
  clearSyncOpsUpTo,
  getProviderWatermark,
  setProviderWatermark,
  getMinSyncedWatermark,
  markProviderReconciled,
  isProviderReconciled,
  SyncQueueOpInput,
} from "../sync-queue"
import { Expense } from "../../types/expense"
import { AppSettings, DEFAULT_SETTINGS } from "../settings-manager"

beforeEach(async () => {
  await clearStorage()
})

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

describe("sync-queue", () => {
  it("tracks watermark and clears up to it", async () => {
    const watermarkBefore = await getSyncQueueWatermark()
    expect(watermarkBefore).toBe(0)

    const op1: SyncQueueOpInput = {
      type: "expense.upsert",
      expense: createExpense("1", "A"),
    }
    const op2: SyncQueueOpInput = {
      type: "expense.upsert",
      expense: createExpense("2", "B"),
    }

    await enqueueSyncOp(op1)
    await enqueueSyncOp(op2)

    const watermark = await getSyncQueueWatermark()
    const opsAfter = await getSyncOpsSince(0)
    expect(opsAfter).toHaveLength(2)

    await clearSyncOpsUpTo(watermark)
    const opsRemaining = await getSyncOpsSince(0)
    expect(opsRemaining).toHaveLength(0)
  })

  it("applies queued expense upserts", () => {
    const base = [createExpense("1", "Base")]
    const updated = { ...base[0], note: "Updated" }
    const added = createExpense("2", "Added")

    const reconciled = applyQueuedOpsToExpenses(base, [
      {
        id: 1,
        timestamp: new Date().toISOString(),
        type: "expense.upsert",
        expense: updated,
      },
      {
        id: 2,
        timestamp: new Date().toISOString(),
        type: "expense.upsert",
        expense: added,
      },
    ])

    expect(reconciled.find((e) => e.id === "1")?.note).toBe("Updated")
    expect(reconciled.find((e) => e.id === "2")?.note).toBe("Added")
  })

  it("applies queued settings and category operations", () => {
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      categories: [
        {
          label: "Food",
          icon: "utensils",
          color: "#fff",
          order: 0,
          isDefault: true,
          updatedAt: new Date().toISOString(),
        },
        {
          label: "Other",
          icon: "more",
          color: "#000",
          order: 1,
          isDefault: false,
          updatedAt: new Date().toISOString(),
        },
      ],
    }

    const reconciled = applyQueuedOpsToSettings(settings, [
      {
        id: 1,
        timestamp: new Date().toISOString(),
        type: "settings.patch",
        updates: { theme: "dark" },
      },
      {
        id: 2,
        timestamp: new Date().toISOString(),
        type: "category.add",
        category: {
          label: "Travel",
          icon: "plane",
          color: "#123",
          order: 0,
          isDefault: false,
          updatedAt: new Date().toISOString(),
        },
      },
      {
        id: 3,
        timestamp: new Date().toISOString(),
        type: "category.update",
        label: "Travel",
        updates: { color: "#456" },
      },
    ])

    expect(reconciled.theme).toBe("dark")
    const travel = reconciled.categories.find((cat) => cat.label === "Travel")
    expect(travel?.color).toBe("#456")
  })

  describe("per-provider watermarks", () => {
    it("getProviderWatermark returns null for unknown provider", async () => {
      const wm = await getProviderWatermark("nonexistent")
      expect(wm).toBeNull()
    })

    it("setProviderWatermark and getProviderWatermark round-trip", async () => {
      await setProviderWatermark("test-provider", 42)
      const wm = await getProviderWatermark("test-provider")
      expect(wm).toBe(42)
    })

    it("setProviderWatermark overwrites previous value", async () => {
      await setProviderWatermark("test-provider", 10)
      await setProviderWatermark("test-provider", 99)
      const wm = await getProviderWatermark("test-provider")
      expect(wm).toBe(99)
    })

    it("getMinSyncedWatermark returns 0 when no providers exist", async () => {
      const min = await getMinSyncedWatermark()
      expect(min).toBe(0)
    })

    it("getMinSyncedWatermark returns min across reconciled providers", async () => {
      await setItem(
        "sync.provider.state",
        JSON.stringify({
          activeProviderId: "github",
          providers: [{ id: "github" }, { id: "drive" }],
        })
      )
      await setProviderWatermark("github", 50)
      await setProviderWatermark("drive", 100)
      await markProviderReconciled("github")
      await markProviderReconciled("drive")

      const min = await getMinSyncedWatermark()
      expect(min).toBe(50)
    })

    it("getMinSyncedWatermark excludes non-reconciled providers", async () => {
      await setItem(
        "sync.provider.state",
        JSON.stringify({
          activeProviderId: "github",
          providers: [{ id: "github" }, { id: "drive" }],
        })
      )
      await setProviderWatermark("github", 50)
      await setProviderWatermark("drive", 100)
      await markProviderReconciled("github")

      const min = await getMinSyncedWatermark()
      expect(min).toBe(50)
    })

    it("getMinSyncedWatermark returns 0 when no providers are reconciled", async () => {
      await setItem(
        "sync.provider.state",
        JSON.stringify({
          activeProviderId: "github",
          providers: [{ id: "github" }],
        })
      )
      await setProviderWatermark("github", 50)

      const min = await getMinSyncedWatermark()
      expect(min).toBe(0)
    })

    it("isProviderReconciled returns false before mark", async () => {
      const r1 = await isProviderReconciled("test-provider")
      expect(r1).toBe(false)
    })

    it("markProviderReconciled and isProviderReconciled round-trip", async () => {
      await markProviderReconciled("test-provider")
      const r = await isProviderReconciled("test-provider")
      expect(r).toBe(true)
    })
  })
})
