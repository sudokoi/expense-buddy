import AsyncStorage from "@react-native-async-storage/async-storage"

const REMOTE_SHA_CACHE_KEY = "remote_sha_cache"

/**
 * Map of filename to git blob SHA from last successful sync
 */
export interface RemoteSHACache {
  [filename: string]: string
}

/**
 * Load the remote SHA cache from AsyncStorage.
 * Returns empty cache on missing or corrupted data.
 */
export async function loadRemoteSHACache(): Promise<RemoteSHACache> {
  try {
    const stored = await AsyncStorage.getItem(REMOTE_SHA_CACHE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate shape: must be a plain object with string values
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        console.warn("Remote SHA cache has invalid shape, resetting")
        return {}
      }
      return parsed
    }
  } catch (error) {
    console.warn("Failed to load remote SHA cache:", error)
  }
  return {}
}

/**
 * Save the remote SHA cache to AsyncStorage
 */
export async function saveRemoteSHACache(cache: RemoteSHACache): Promise<void> {
  try {
    await AsyncStorage.setItem(REMOTE_SHA_CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    console.warn("Failed to save remote SHA cache:", error)
  }
}

/**
 * Clear the remote SHA cache (for reset/debug)
 */
export async function clearRemoteSHACache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(REMOTE_SHA_CACHE_KEY)
  } catch (error) {
    console.warn("Failed to clear remote SHA cache:", error)
  }
}
