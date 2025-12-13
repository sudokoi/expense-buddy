import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Expense } from '../types/expense';
import { exportToCSV, importFromCSV } from './csv-handler';
import { uploadCSV, downloadCSV, validatePAT } from './github-sync';

const GITHUB_TOKEN_KEY = 'github_pat';
const GITHUB_REPO_KEY = 'github_repo';
const GITHUB_BRANCH_KEY = 'github_branch';

export interface SyncConfig {
  token: string;
  repo: string;
  branch: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  error?: string;
}

// Helper functions for secure storage with platform check
async function secureSetItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function secureGetItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return await AsyncStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
}

async function secureDeleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * Save GitHub sync configuration securely
 */
export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  await secureSetItem(GITHUB_TOKEN_KEY, config.token);
  await secureSetItem(GITHUB_REPO_KEY, config.repo);
  await secureSetItem(GITHUB_BRANCH_KEY, config.branch);
}

/**
 * Load GitHub sync configuration
 */
export async function loadSyncConfig(): Promise<SyncConfig | null> {
  const token = await secureGetItem(GITHUB_TOKEN_KEY);
  const repo = await secureGetItem(GITHUB_REPO_KEY);
  const branch = await secureGetItem(GITHUB_BRANCH_KEY);

  if (!token || !repo || !branch) {
    return null;
  }

  return { token, repo, branch };
}

/**
 * Clear GitHub sync configuration
 */
export async function clearSyncConfig(): Promise<void> {
  await secureDeleteItem(GITHUB_TOKEN_KEY);
  await secureDeleteItem(GITHUB_REPO_KEY);
  await secureDeleteItem(GITHUB_BRANCH_KEY);
}

/**
 * Test GitHub connection with current config
 */
export async function testConnection(): Promise<SyncResult> {
  const config = await loadSyncConfig();
  if (!config) {
    return { success: false, message: 'No sync configuration found', error: 'Configuration missing' };
  }

  const result = await validatePAT(config.token, config.repo);
  if (result.valid) {
    return { success: true, message: 'Connection successful!' };
  } else {
    return { success: false, message: 'Connection failed', error: result.error };
  }
}

/**
 * Sync expenses to GitHub (upload)
 */
export async function syncUp(expenses: Expense[]): Promise<SyncResult> {
  try {
    const config = await loadSyncConfig();
    if (!config) {
      return { success: false, message: 'Sync not configured', error: 'No configuration' };
    }

    const csvContent = exportToCSV(expenses);
    const result = await uploadCSV(config.token, config.repo, config.branch, csvContent);

    if (result.success) {
      return { success: true, message: `Synced ${expenses.length} expenses to GitHub` };
    } else {
      return { success: false, message: 'Upload failed', error: result.error };
    }
  } catch (error) {
    return { success: false, message: 'Sync failed', error: String(error) };
  }
}

/**
 * Sync expenses from GitHub (download)
 */
export async function syncDown(): Promise<{ success: boolean; message: string; expenses?: Expense[]; error?: string }> {
  try {
    const config = await loadSyncConfig();
    if (!config) {
      return { success: false, message: 'Sync not configured', error: 'No configuration' };
    }

    const fileData = await downloadCSV(config.token, config.repo, config.branch);
    if (!fileData) {
      return { success: false, message: 'No data found in repository', error: 'File not found' };
    }

    const expenses = importFromCSV(fileData.content);
    return {
      success: true,
      message: `Downloaded ${expenses.length} expenses from GitHub`,
      expenses,
    };
  } catch (error) {
    return { success: false, message: 'Download failed', error: String(error) };
  }
}

const LAST_SYNC_TIME_KEY = 'last_sync_time';

/**
 * Get last sync timestamp
 */
async function getLastSyncTime(): Promise<string | null> {
  return await secureGetItem(LAST_SYNC_TIME_KEY);
}

/**
 * Save last sync timestamp
 */
async function saveLastSyncTime(): Promise<void> {
  const now = new Date().toISOString();
  await secureSetItem(LAST_SYNC_TIME_KEY, now);
}

/**
 * Bidirectional sync with timestamp-based conflict resolution
 */
export async function autoSync(localExpenses: Expense[]): Promise<SyncResult & { expenses?: Expense[] }> {
  try {
    const lastSyncTime = await getLastSyncTime();
    const downloadResult = await syncDown();
    
    if (downloadResult.success && downloadResult.expenses) {
      const remoteExpenses = downloadResult.expenses;
      const merged = mergeExpensesWithTimestamps(localExpenses, remoteExpenses, lastSyncTime);

      // Upload merged data
      const uploadResult = await syncUp(merged);
      
      if (uploadResult.success) {
        await saveLastSyncTime();
        return {
          success: true,
          message: `Synced: ${merged.length} expenses (${localExpenses.length} local, ${remoteExpenses.length} remote)`,
          expenses: merged,
        };
      } else {
        return { success: false, message: 'Upload after merge failed', error: uploadResult.error };
      }
    } else {
      // No remote data, just upload local
      const uploadResult = await syncUp(localExpenses);
      if (uploadResult.success) {
        await saveLastSyncTime();
      }
      return {
        success: uploadResult.success,
        message: uploadResult.message,
        error: uploadResult.error,
      };
    }
  } catch (error) {
    return { success: false, message: 'Auto-sync failed', error: String(error) };
  }
}

/**
 * Merge expenses using timestamps to resolve conflicts
 * Rules:
 * 1. For expenses in both: keep the one with the latest updatedAt
 * 2. For expenses only in remote: 
 *    - If lastSyncTime exists and is newer than the item, it was deleted locally → skip it
 *    - Otherwise, it's new on remote → add it
 * 3. For expenses only in local: keep them (they're new locally or synced before)
 */
function mergeExpensesWithTimestamps(
  local: Expense[],
  remote: Expense[],
  lastSyncTime: string | null
): Expense[] {
  const localMap = new Map(local.map(e => [e.id, e]));
  const remoteMap = new Map(remote.map(e => [e.id, e]));
  const merged: Expense[] = [];

  // Process all unique IDs
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const id of allIds) {
    const localItem = localMap.get(id);
    const remoteItem = remoteMap.get(id);

    if (localItem && remoteItem) {
      // Conflict: exists in both - keep the newer one based on updatedAt
      const localTime = new Date(localItem.updatedAt).getTime();
      const remoteTime = new Date(remoteItem.updatedAt).getTime();
      merged.push(remoteTime > localTime ? remoteItem : localItem);
    } else if (localItem) {
      // Only in local - keep it
      merged.push(localItem);
    } else if (remoteItem) {
      // Only in remote - check if it was deleted locally
      if (lastSyncTime) {
        const lastSync = new Date(lastSyncTime).getTime();
        const itemUpdated = new Date(remoteItem.updatedAt).getTime();
        
        // If last sync is newer than the item, it means we saw this item before
        // and it's gone now from local, so it was deleted - don't restore it
        if (lastSync > itemUpdated) {
          console.log(`Skipping remote item ${id} - was deleted locally after last sync`);
          continue;
        }
      }
      // It's a new remote item or we don't have sync history - add it
      merged.push(remoteItem);
    }
  }

  // Sort by creation date (newest first)
  return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
