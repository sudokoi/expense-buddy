import AsyncStorage from "@react-native-async-storage/async-storage"

const BASE_KEY = "sync.providers"

function buildKey(providerId: string, field: string): string {
  return `${BASE_KEY}.${providerId}.${field}`
}

export const providerStateStore = {
  async get<T>(providerId: string, field: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(buildKey(providerId, field))
      if (!raw) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  },

  async set<T>(providerId: string, field: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(buildKey(providerId, field), JSON.stringify(value))
    } catch (error) {
      console.warn(`Failed to save provider state (${providerId}/${field}):`, error)
    }
  },

  async remove(providerId: string, field: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(buildKey(providerId, field))
    } catch (error) {
      console.warn(`Failed to remove provider state (${providerId}/${field}):`, error)
    }
  },

  async clearProvider(providerId: string): Promise<void> {
    const keys = await AsyncStorage.getAllKeys()
    const prefix = buildKey(providerId, "")
    const toRemove = keys.filter((key) => key.startsWith(prefix))
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove)
    }
  },
}
