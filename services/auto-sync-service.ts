import { Expense } from '../types/expense';
import { 
  autoSync, 
  loadAutoSyncSettings, 
  loadSyncConfig,
  AutoSyncSettings,
  SyncNotification,
} from './sync-manager';

/**
 * Main auto-sync orchestration function
 * Checks if auto-sync is enabled and performs sync if configured
 */
export async function performAutoSyncIfEnabled(
  localExpenses: Expense[]
): Promise<{ 
  synced: boolean; 
  expenses?: Expense[]; 
  notification?: SyncNotification;
  error?: string;
}> {
  try {
    // Check if auto-sync is enabled
    const settings = await loadAutoSyncSettings();
    if (!settings.enabled) {
      return { synced: false };
    }

    // Check if GitHub sync is configured
    const config = await loadSyncConfig();
    if (!config) {
      console.log('Auto-sync enabled but GitHub not configured');
      return { synced: false };
    }

    // Perform the sync
    const result = await autoSync(localExpenses);
    
    if (result.success && result.expenses) {
      return {
        synced: true,
        expenses: result.expenses,
        notification: result.notification,
      };
    } else {
      return {
        synced: false,
        error: result.error || result.message,
      };
    }
  } catch (error) {
    console.error('Auto-sync failed:', error);
    return {
      synced: false,
      error: String(error),
    };
  }
}

/**
 * Check if auto-sync should run for the given timing
 */
export async function shouldAutoSyncForTiming(timing: 'on_launch' | 'on_expense_entry'): Promise<boolean> {
  const settings = await loadAutoSyncSettings();
  return settings.enabled && settings.timing === timing;
}
