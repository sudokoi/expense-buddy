import AsyncStorage from "@react-native-async-storage/async-storage"

const FILE_HASHES_KEY = "file_content_hashes"

/**
 * Map of filename to content hash
 */
export interface FileHashMap {
  [filename: string]: string
}

/**
 * Compute a simple hash of content using djb2 algorithm
 * This is a fast, deterministic hash suitable for change detection
 */
export function computeContentHash(content: string): string {
  let hash = 5381
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(i)
    // Keep hash as 32-bit integer
    hash = hash >>> 0
  }
  return hash.toString(16)
}

/**
 * Save file hashes to AsyncStorage
 */
export async function saveFileHashes(hashes: FileHashMap): Promise<void> {
  try {
    await AsyncStorage.setItem(FILE_HASHES_KEY, JSON.stringify(hashes))
  } catch (error) {
    console.warn("Failed to save file hashes:", error)
  }
}

/**
 * Load file hashes from AsyncStorage
 */
export async function loadFileHashes(): Promise<FileHashMap> {
  try {
    const stored = await AsyncStorage.getItem(FILE_HASHES_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.warn("Failed to load file hashes:", error)
  }
  return {}
}

/**
 * Clear all stored file hashes (for reset/debug functionality)
 */
export async function clearFileHashes(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FILE_HASHES_KEY)
  } catch (error) {
    console.warn("Failed to clear file hashes:", error)
  }
}
