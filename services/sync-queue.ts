import AsyncStorage from "@react-native-async-storage/async-storage"
import { Expense } from "../types/expense"
import { AppSettings } from "./settings-manager"
import { Category } from "../types/category"
import { getRandomCategoryColor } from "../constants/category-colors"

const SYNC_QUEUE_KEY = "sync_queue_v1"
const SYNC_QUEUE_VERSION = 1

export type SyncQueueOp =
  | {
      id: number
      timestamp: string
      type: "expense.upsert"
      expense: Expense
    }
  | {
      id: number
      timestamp: string
      type: "expense.batchUpsert"
      expenses: Expense[]
    }
  | {
      id: number
      timestamp: string
      type: "settings.patch"
      updates: Partial<AppSettings>
    }
  | {
      id: number
      timestamp: string
      type: "category.add"
      category: Category
    }
  | {
      id: number
      timestamp: string
      type: "category.update"
      label: string
      updates: Partial<Omit<Category, "updatedAt">> & { updatedAt?: string }
    }
  | {
      id: number
      timestamp: string
      type: "category.delete"
      label: string
    }
  | {
      id: number
      timestamp: string
      type: "category.reorder"
      labels: string[]
    }

export type SyncQueueOpInput =
  | {
      type: "expense.upsert"
      expense: Expense
      timestamp?: string
    }
  | {
      type: "expense.batchUpsert"
      expenses: Expense[]
      timestamp?: string
    }
  | {
      type: "settings.patch"
      updates: Partial<AppSettings>
      timestamp?: string
    }
  | {
      type: "category.add"
      category: Category
      timestamp?: string
    }
  | {
      type: "category.update"
      label: string
      updates: Partial<Omit<Category, "updatedAt">> & { updatedAt?: string }
      timestamp?: string
    }
  | {
      type: "category.delete"
      label: string
      timestamp?: string
    }
  | {
      type: "category.reorder"
      labels: string[]
      timestamp?: string
    }

interface SyncQueueState {
  version: number
  nextId: number
  ops: SyncQueueOp[]
}

const emptyState: SyncQueueState = {
  version: SYNC_QUEUE_VERSION,
  nextId: 1,
  ops: [],
}

let writeQueue = Promise.resolve()

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation)
  writeQueue = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

async function loadState(): Promise<SyncQueueState> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY)
    if (!stored) {
      return { ...emptyState }
    }
    const parsed = JSON.parse(stored) as Partial<SyncQueueState>
    if (!parsed || parsed.version !== SYNC_QUEUE_VERSION) {
      return { ...emptyState }
    }
    const ops = Array.isArray(parsed.ops) ? (parsed.ops as SyncQueueOp[]) : []
    const nextId = typeof parsed.nextId === "number" ? parsed.nextId : 1
    return {
      version: SYNC_QUEUE_VERSION,
      nextId,
      ops: ops.sort((a, b) => a.id - b.id),
    }
  } catch (error) {
    console.warn("Failed to load sync queue:", error)
    return { ...emptyState }
  }
}

async function saveState(state: SyncQueueState): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn("Failed to save sync queue:", error)
  }
}

export async function enqueueSyncOp(op: SyncQueueOpInput): Promise<SyncQueueOp> {
  return enqueueWrite(async () => {
    const state = await loadState()
    const { timestamp, ...rest } = op
    const nextOp: SyncQueueOp = {
      ...(rest as Omit<SyncQueueOp, "id" | "timestamp">),
      id: state.nextId,
      timestamp: timestamp ?? new Date().toISOString(),
    } as SyncQueueOp
    const nextState: SyncQueueState = {
      ...state,
      nextId: state.nextId + 1,
      ops: [...state.ops, nextOp],
    }
    await saveState(nextState)
    return nextOp
  })
}

export async function getSyncQueueWatermark(): Promise<number> {
  const state = await loadState()
  return Math.max(0, state.nextId - 1)
}

export async function getSyncOpsSince(watermark: number): Promise<SyncQueueOp[]> {
  const state = await loadState()
  return state.ops.filter((op) => op.id > watermark).sort((a, b) => a.id - b.id)
}

export async function clearSyncOpsUpTo(watermark: number): Promise<void> {
  await enqueueWrite(async () => {
    const state = await loadState()
    const remaining = state.ops.filter((op) => op.id > watermark)
    const nextState: SyncQueueState = {
      ...state,
      ops: remaining,
    }
    await saveState(nextState)
  })
}

export function applyQueuedOpsToExpenses(
  expenses: Expense[],
  ops: SyncQueueOp[]
): Expense[] {
  const expenseMap = new Map(expenses.map((expense) => [expense.id, expense]))
  const sortedOps = [...ops].sort((a, b) => a.id - b.id)

  for (const op of sortedOps) {
    if (op.type === "expense.upsert") {
      expenseMap.set(op.expense.id, op.expense)
    } else if (op.type === "expense.batchUpsert") {
      for (const expense of op.expenses) {
        expenseMap.set(expense.id, expense)
      }
    }
  }

  return Array.from(expenseMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function applyQueuedOpsToSettings(
  settings: AppSettings,
  ops: SyncQueueOp[]
): AppSettings {
  let nextSettings = { ...settings }
  const sortedOps = [...ops].sort((a, b) => a.id - b.id)

  for (const op of sortedOps) {
    switch (op.type) {
      case "settings.patch":
        nextSettings = { ...nextSettings, ...op.updates }
        break
      case "category.add":
        nextSettings = applyCategoryAdd(nextSettings, op.category)
        break
      case "category.update":
        nextSettings = applyCategoryUpdate(nextSettings, op.label, op.updates)
        break
      case "category.delete":
        nextSettings = applyCategoryDelete(nextSettings, op.label)
        break
      case "category.reorder":
        nextSettings = applyCategoryReorder(nextSettings, op.labels)
        break
      default:
        break
    }
  }

  return nextSettings
}

function applyCategoryAdd(settings: AppSettings, category: Category): AppSettings {
  const existingColors = settings.categories.map((c) => c.color)
  const otherCategory = settings.categories.find((c) => c.label === "Other")
  const otherOrder = otherCategory?.order ?? settings.categories.length

  const normalizedCategory: Category = {
    ...category,
    label: category.label.trim(),
    icon: category.icon.trim(),
    color: category.color || getRandomCategoryColor(existingColors),
    order: otherOrder,
    updatedAt: category.updatedAt ?? new Date().toISOString(),
  }

  const existingIndex = settings.categories.findIndex(
    (cat) => cat.label.toLowerCase() === normalizedCategory.label.toLowerCase()
  )

  let nextCategories = settings.categories.map((cat) => {
    if (cat.label === "Other") {
      return {
        ...cat,
        order: otherOrder + 1,
        updatedAt: new Date().toISOString(),
      }
    }
    return cat
  })

  if (existingIndex >= 0) {
    nextCategories = nextCategories.map((cat, index) =>
      index === existingIndex ? { ...cat, ...normalizedCategory } : cat
    )
  } else {
    nextCategories = [...nextCategories, normalizedCategory]
  }

  return { ...settings, categories: nextCategories }
}

function applyCategoryUpdate(
  settings: AppSettings,
  label: string,
  updates: Partial<Omit<Category, "updatedAt">> & { updatedAt?: string }
): AppSettings {
  const normalizedLabel = label.trim()
  const normalizedUpdates: typeof updates = {
    ...updates,
    ...(updates.label ? { label: updates.label.trim() } : {}),
    ...(updates.icon ? { icon: updates.icon.trim() } : {}),
  }

  const nextCategories = settings.categories.map((cat) => {
    if (cat.label === normalizedLabel) {
      return {
        ...cat,
        ...normalizedUpdates,
        updatedAt: normalizedUpdates.updatedAt ?? new Date().toISOString(),
      }
    }
    return cat
  })

  return { ...settings, categories: nextCategories }
}

function applyCategoryDelete(settings: AppSettings, label: string): AppSettings {
  if (label === "Other") {
    return settings
  }

  const nextCategories = settings.categories
    .filter((cat) => cat.label !== label)
    .map((cat) => {
      if (cat.label === "Other") {
        return {
          ...cat,
          order: cat.order - 1,
          updatedAt: new Date().toISOString(),
        }
      }
      return cat
    })

  return { ...settings, categories: nextCategories }
}

function applyCategoryReorder(settings: AppSettings, labels: string[]): AppSettings {
  const categoryMap = new Map(settings.categories.map((cat) => [cat.label, cat]))
  const normalizedLabels = labels.map((label) => label.trim())

  const reordered = normalizedLabels
    .map((label, index) => {
      const cat = categoryMap.get(label)
      if (!cat) return null
      return {
        ...cat,
        order: index,
        updatedAt: new Date().toISOString(),
      }
    })
    .filter((cat): cat is Category => cat !== null)

  const labelsSet = new Set(normalizedLabels)
  const missingCategories = settings.categories
    .filter((cat) => !labelsSet.has(cat.label))
    .map((cat, index) => ({
      ...cat,
      order: reordered.length + index,
      updatedAt: new Date().toISOString(),
    }))

  return { ...settings, categories: [...reordered, ...missingCategories] }
}
