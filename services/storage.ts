import { createMMKV } from "react-native-mmkv"
import AsyncStorage from "@react-native-async-storage/async-storage"

const mmkv = createMMKV({ id: "expense-buddy" })

const MIGRATED_KEY = "_migrated_from_async_storage"

let migrated = false
let migrationPromise: Promise<void> | null = null

async function ensureMigrated(): Promise<void> {
  if (migrated) return
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
    } catch (e) {
      console.warn("Failed to migrate AsyncStorage to MMKV:", e)
      mmkv.set(MIGRATED_KEY, true)
    }
    migrated = true
    migrationPromise = null
  })()
  return migrationPromise
}

export async function getItem(key: string): Promise<string | null> {
  await ensureMigrated()
  return mmkv.getString(key) ?? null
}

export async function setItem(key: string, value: string): Promise<void> {
  await ensureMigrated()
  mmkv.set(key, value)
}

export async function removeItem(key: string): Promise<void> {
  await ensureMigrated()
  mmkv.remove(key)
}

export async function getAllKeys(): Promise<string[]> {
  await ensureMigrated()
  return mmkv.getAllKeys()
}

export async function multiGet(keys: string[]): Promise<[string, string | null][]> {
  await ensureMigrated()
  return keys.map((k) => [k, mmkv.getString(k) ?? null])
}

export async function multiSet(keyValuePairs: [string, string][]): Promise<void> {
  await ensureMigrated()
  for (const [key, value] of keyValuePairs) {
    mmkv.set(key, value)
  }
}

export async function multiRemove(keys: string[]): Promise<void> {
  await ensureMigrated()
  for (const key of keys) {
    mmkv.remove(key)
  }
}

export async function clear(): Promise<void> {
  mmkv.clearAll()
}
