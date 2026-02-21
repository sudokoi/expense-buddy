/**
 * Merchant Pattern GitHub Sync
 *
 * Synchronizes learned merchant patterns and user corrections across devices
 * via GitHub, following the same upload/download pattern as settings sync.
 */

import type { SyncConfig } from "../../types/sync"
import type {
  MerchantPattern,
  MerchantPatternsFile,
  MerchantPatternSyncResult,
  UserCorrection,
} from "../../types/merchant-patterns"
import { merchantLearningEngine } from "./learning-engine"

const MERCHANT_PATTERNS_FILE_PATH = "merchant-patterns.json"
const CURRENT_VERSION = 1

/**
 * Merge two sets of merchant patterns, combining usage data and keeping the most recent info.
 *
 * For matching patterns (by normalizedName):
 * - Keep the one with higher usageCount as base
 * - Sum both usageCounts
 * - Union rawPatterns arrays (no duplicates)
 * - Keep the most recent lastUsed timestamp
 * - Keep userOverridden = true if either has it
 *
 * For patterns only in one set, include as-is.
 */
export function mergeMerchantPatterns(
  local: MerchantPatternsFile,
  remote: MerchantPatternsFile
): MerchantPatternsFile {
  const mergedPatterns = mergePatternArrays(local.patterns, remote.patterns)
  const mergedCorrections = mergeCorrectionArrays(local.corrections, remote.corrections)

  return {
    version: CURRENT_VERSION,
    lastSyncedAt: new Date().toISOString(),
    patterns: mergedPatterns,
    corrections: mergedCorrections,
  }
}

/**
 * Merge two arrays of merchant patterns by normalizedName.
 */
function mergePatternArrays(
  localPatterns: MerchantPattern[],
  remotePatterns: MerchantPattern[]
): MerchantPattern[] {
  const localMap = new Map(localPatterns.map((p) => [p.normalizedName, p]))
  const remoteMap = new Map(remotePatterns.map((p) => [p.normalizedName, p]))

  const allKeys = new Set([...localMap.keys(), ...remoteMap.keys()])
  const merged: MerchantPattern[] = []

  for (const key of allKeys) {
    const localP = localMap.get(key)
    const remoteP = remoteMap.get(key)

    if (localP && remoteP) {
      // Both exist — merge them
      const base =
        localP.usageCount >= remoteP.usageCount ? { ...localP } : { ...remoteP }
      base.usageCount = localP.usageCount + remoteP.usageCount
      base.rawPatterns = unionArrays(localP.rawPatterns, remoteP.rawPatterns)
      base.lastUsed =
        new Date(localP.lastUsed).getTime() >= new Date(remoteP.lastUsed).getTime()
          ? localP.lastUsed
          : remoteP.lastUsed
      base.userOverridden = localP.userOverridden || remoteP.userOverridden
      merged.push(base)
    } else {
      // Only in one set — include with deduplicated rawPatterns
      const pattern = localP ?? remoteP!
      merged.push({
        ...pattern,
        rawPatterns: Array.from(new Set(pattern.rawPatterns)),
      })
    }
  }

  return merged
}

/**
 * Merge two arrays of user corrections, deduplicating by ID.
 * When the same ID exists in both, keep the one with the more recent timestamp.
 */
function mergeCorrectionArrays(
  localCorrections: UserCorrection[],
  remoteCorrections: UserCorrection[]
): UserCorrection[] {
  const map = new Map<string, UserCorrection>()

  for (const c of localCorrections) {
    map.set(c.id, c)
  }

  for (const c of remoteCorrections) {
    const existing = map.get(c.id)
    if (!existing) {
      map.set(c.id, c)
    } else {
      // Keep the more recent one
      if (new Date(c.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
        map.set(c.id, c)
      }
    }
  }

  return Array.from(map.values())
}

/**
 * Union two string arrays without duplicates.
 */
function unionArrays(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]))
}

/**
 * Download merchant patterns file from GitHub.
 * Returns null if the file doesn't exist yet.
 */
async function downloadMerchantPatterns(
  config: SyncConfig
): Promise<{ content: MerchantPatternsFile; sha: string } | null> {
  const [owner, repoName] = config.repo.split("/")
  if (!owner || !repoName) {
    throw new Error("Invalid repository format")
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/contents/${MERCHANT_PATTERNS_FILE_PATH}?ref=${config.branch}`,
    {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const decodedContent = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))))

  return {
    content: JSON.parse(decodedContent) as MerchantPatternsFile,
    sha: data.sha as string,
  }
}

/**
 * Upload merchant patterns file to GitHub.
 * Creates or updates the file using the GitHub Contents API.
 */
async function uploadMerchantPatterns(
  config: SyncConfig,
  patternsFile: MerchantPatternsFile,
  existingSha?: string
): Promise<{ success: boolean; error?: string }> {
  const [owner, repoName] = config.repo.split("/")
  if (!owner || !repoName) {
    return { success: false, error: "Invalid repository format" }
  }

  const content = JSON.stringify(patternsFile, null, 2)
  const encodedContent = btoa(unescape(encodeURIComponent(content)))

  const requestBody: {
    message: string
    content: string
    branch: string
    sha?: string
  } = {
    message: `Update merchant patterns - ${new Date().toISOString()}`,
    content: encodedContent,
    branch: config.branch,
  }

  if (existingSha) {
    requestBody.sha = existingSha
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/contents/${MERCHANT_PATTERNS_FILE_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(requestBody),
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    return {
      success: false,
      error: (errorData as { message?: string }).message || response.statusText,
    }
  }

  return { success: true }
}

/**
 * Build a MerchantPatternsFile from the learning engine's current state.
 */
async function buildLocalPatternsFile(): Promise<MerchantPatternsFile> {
  const patterns = await merchantLearningEngine.getAllPatterns()
  const corrections = await merchantLearningEngine.getAllCorrections()

  return {
    version: CURRENT_VERSION,
    lastSyncedAt: new Date().toISOString(),
    patterns,
    corrections,
  }
}

/**
 * Apply merged patterns back to the learning engine's storage.
 * Writes directly to AsyncStorage since the learning engine doesn't expose a bulk import method.
 */
async function applyMergedPatterns(merged: MerchantPatternsFile): Promise<void> {
  const AsyncStorage = require("@react-native-async-storage/async-storage").default
  const { STORAGE_KEYS } = require("./constants")

  await AsyncStorage.setItem(
    STORAGE_KEYS.MERCHANT_PATTERNS,
    JSON.stringify(merged.patterns)
  )
  await AsyncStorage.setItem(
    STORAGE_KEYS.USER_CORRECTIONS,
    JSON.stringify(merged.corrections)
  )

  // Re-initialize the learning engine to pick up merged data
  await merchantLearningEngine.initialize()
}

/**
 * Sync merchant patterns with GitHub.
 *
 * Flow:
 * 1. Download remote merchant-patterns.json (if exists)
 * 2. Load local patterns from learning engine
 * 3. Merge local and remote
 * 4. Save merged result locally
 * 5. Upload merged result to GitHub
 */
export async function syncMerchantPatterns(
  syncConfig: SyncConfig
): Promise<MerchantPatternSyncResult> {
  try {
    // 1. Download remote patterns
    let remoteResult: { content: MerchantPatternsFile; sha: string } | null = null
    try {
      remoteResult = await downloadMerchantPatterns(syncConfig)
    } catch (error) {
      console.warn("Failed to download remote merchant patterns:", error)
      // Continue with local-only — will push local patterns
    }

    // 2. Load local patterns
    const localFile = await buildLocalPatternsFile()

    // 3. Merge or use local-only
    let mergedFile: MerchantPatternsFile
    let wasMerged = false

    if (remoteResult) {
      mergedFile = mergeMerchantPatterns(localFile, remoteResult.content)
      wasMerged = true
    } else {
      mergedFile = localFile
    }

    // 4. Save merged result locally
    await applyMergedPatterns(mergedFile)

    // 5. Upload merged result to GitHub
    const uploadResult = await uploadMerchantPatterns(
      syncConfig,
      mergedFile,
      remoteResult?.sha
    )

    if (!uploadResult.success) {
      return {
        success: false,
        uploaded: 0,
        downloaded: remoteResult ? remoteResult.content.patterns.length : 0,
        merged: wasMerged,
        conflicts: 0,
      }
    }

    return {
      success: true,
      uploaded: mergedFile.patterns.length,
      downloaded: remoteResult ? remoteResult.content.patterns.length : 0,
      merged: wasMerged,
      conflicts: 0,
    }
  } catch (error) {
    console.error("Merchant pattern sync failed:", error)
    return {
      success: false,
      uploaded: 0,
      downloaded: 0,
      merged: false,
    }
  }
}
