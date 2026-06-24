import AsyncStorage from "@react-native-async-storage/async-storage"

function createMmkvOrNull() {
  try {
    const { createMMKV } =
      require("react-native-mmkv") as typeof import("react-native-mmkv")
    return createMMKV({ id: "expense-buddy" })
  } catch {
    return null
  }
}

const mmkv = createMmkvOrNull()

const MIGRATED_KEY = "_migrated_from_async_storage"

let migrated = false
let migrationPromise: Promise<void> | null = null

async function ensureMigrated(): Promise<void> {
  if (migrated) return
  if (!mmkv) return
  if (migrationPromise) return migrationPromise
  if (mmkv.getBoolean(MIGRATED_KEY)) {
    migrated = true
    return
  }
  migrationPromise = (async () => {
    try {
      const keys = await AsyncStorage.getAllKeys()
      if (keys.length > 0) {
        const entries = await AsyncStorage.multiGet(keys)
        for (const [key, value] of entries) {
          if (value !== null) mmkv.set(key, value)
        }
      }
      mmkv.set(MIGRATED_KEY, true)
      await AsyncStorage.clear()
      migrated = true
    } catch (e) {
      // Do NOT set MIGRATED_KEY or mark migrated here. AsyncStorage.clear()
      // hasn't run, so the original data is still intact. Leaving the flag
      // unset lets migration retry on the next launch (it is idempotent).
      console.warn("Failed to migrate AsyncStorage to MMKV, will retry next launch:", e)
    } finally {
      migrationPromise = null
    }
  })()
  return migrationPromise
}

export async function getItem(key: string): Promise<string | null> {
  await ensureMigrated()
  if (!mmkv) return AsyncStorage.getItem(key)
  return mmkv.getString(key) ?? null
}

export async function setItem(key: string, value: string): Promise<void> {
  await ensureMigrated()
  if (!mmkv) {
    await AsyncStorage.setItem(key, value)
    return
  }
  mmkv.set(key, value)
}

export async function removeItem(key: string): Promise<void> {
  await ensureMigrated()
  if (!mmkv) {
    await AsyncStorage.removeItem(key)
    return
  }
  mmkv.remove(key)
}

export async function getAllKeys(): Promise<string[]> {
  await ensureMigrated()
  if (!mmkv) return AsyncStorage.getAllKeys().then((keys) => [...keys])
  // Exclude the internal migration flag so callers only see real data keys.
  return mmkv.getAllKeys().filter((key) => key !== MIGRATED_KEY)
}

export async function multiGet(keys: string[]): Promise<[string, string | null][]> {
  await ensureMigrated()
  if (!mmkv) {
    const entries = await AsyncStorage.multiGet(keys)
    return entries.map(([k, v]) => [k, v ?? null])
  }
  return keys.map((k) => [k, mmkv.getString(k) ?? null])
}

export async function multiSet(keyValuePairs: [string, string][]): Promise<void> {
  await ensureMigrated()
  if (!mmkv) {
    await AsyncStorage.multiSet(keyValuePairs)
    return
  }
  for (const [key, value] of keyValuePairs) {
    mmkv.set(key, value)
  }
}

export async function multiRemove(keys: string[]): Promise<void> {
  await ensureMigrated()
  if (!mmkv) {
    await AsyncStorage.multiRemove(keys)
    return
  }
  for (const key of keys) {
    mmkv.remove(key)
  }
}

export async function clear(): Promise<void> {
  // Ensure migration runs first; otherwise a clear() before the first read
  // would wipe MMKV (still empty) while leaving AsyncStorage intact, and the
  // next read would migrate that stale data back in.
  await ensureMigrated()
  if (!mmkv) {
    await AsyncStorage.clear()
    return
  }
  mmkv.clearAll()
}
