import AsyncStorage from "@react-native-async-storage/async-storage"

const DIRTY_DAYS_KEY = "expense_dirty_days"
const DIRTY_DAYS_VERSION = 1

export interface DirtyDaysState {
  version: number
  dirtyDays: string[]
  deletedDays: string[]
  updatedAt: string
}

export interface DirtyDaysLoadResult {
  state: DirtyDaysState
  isTrusted: boolean
}

const emptyState: DirtyDaysState = {
  version: DIRTY_DAYS_VERSION,
  dirtyDays: [],
  deletedDays: [],
  updatedAt: new Date(0).toISOString(),
}

function normalizeState(state: DirtyDaysState): DirtyDaysState {
  const uniqueDirty = Array.from(new Set(state.dirtyDays)).sort()
  const uniqueDeleted = Array.from(new Set(state.deletedDays)).sort()

  return {
    version: DIRTY_DAYS_VERSION,
    dirtyDays: uniqueDirty,
    deletedDays: uniqueDeleted,
    updatedAt: state.updatedAt || new Date().toISOString(),
  }
}

async function saveState(state: DirtyDaysState): Promise<void> {
  try {
    await AsyncStorage.setItem(DIRTY_DAYS_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn("Failed to save dirty days:", error)
  }
}

export async function loadDirtyDays(): Promise<DirtyDaysLoadResult> {
  try {
    const stored = await AsyncStorage.getItem(DIRTY_DAYS_KEY)
    if (!stored) {
      return { state: { ...emptyState }, isTrusted: false }
    }

    const parsed = JSON.parse(stored) as Partial<DirtyDaysState>
    if (!parsed || typeof parsed !== "object") {
      return { state: { ...emptyState }, isTrusted: false }
    }

    if (parsed.version !== DIRTY_DAYS_VERSION) {
      return { state: { ...emptyState }, isTrusted: false }
    }

    const state: DirtyDaysState = {
      version: DIRTY_DAYS_VERSION,
      dirtyDays: Array.isArray(parsed.dirtyDays) ? parsed.dirtyDays : [],
      deletedDays: Array.isArray(parsed.deletedDays) ? parsed.deletedDays : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    }

    return { state: normalizeState(state), isTrusted: true }
  } catch (error) {
    console.warn("Failed to load dirty days:", error)
    return { state: { ...emptyState }, isTrusted: false }
  }
}

export async function saveDirtyDays(state: DirtyDaysState): Promise<void> {
  await saveState(normalizeState(state))
}

export async function markDirtyDay(dayKey: string): Promise<DirtyDaysState> {
  const { state } = await loadDirtyDays()
  const nextState = normalizeState({
    ...state,
    dirtyDays: [...state.dirtyDays, dayKey],
    updatedAt: new Date().toISOString(),
  })
  await saveState(nextState)
  return nextState
}

export async function markDeletedDay(dayKey: string): Promise<DirtyDaysState> {
  const { state } = await loadDirtyDays()
  const nextState = normalizeState({
    ...state,
    dirtyDays: [...state.dirtyDays, dayKey],
    deletedDays: [...state.deletedDays, dayKey],
    updatedAt: new Date().toISOString(),
  })
  await saveState(nextState)
  return nextState
}

export async function clearDirtyDays(): Promise<void> {
  await saveState({
    ...emptyState,
    updatedAt: new Date().toISOString(),
  })
}

export async function consumeDirtyDays(): Promise<DirtyDaysLoadResult> {
  const result = await loadDirtyDays()
  await clearDirtyDays()
  return result
}

export function dirtyDaysStorageKeyForTests(): string {
  return DIRTY_DAYS_KEY
}
