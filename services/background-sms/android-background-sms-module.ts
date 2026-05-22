import { Platform } from "react-native"
import {
  BackgroundSmsState,
  ExpenseBuddyBackgroundSmsNativeModule,
} from "../../modules/expense-buddy-background-sms"
import ExpenseBuddyBackgroundSmsModule from "../../modules/expense-buddy-background-sms"
import { SmsImportReviewQueueSnapshot } from "../../types/sms-import"

let moduleOverride: ExpenseBuddyBackgroundSmsNativeModule | null = null

export function setBackgroundSmsModuleForTesting(
  nextModule: ExpenseBuddyBackgroundSmsNativeModule | null
): void {
  moduleOverride = nextModule
}

function getBackgroundSmsModule(): ExpenseBuddyBackgroundSmsNativeModule | null {
  if (Platform.OS !== "android") {
    return null
  }

  return moduleOverride ?? ExpenseBuddyBackgroundSmsModule
}

export async function getBackgroundSmsState(): Promise<BackgroundSmsState> {
  const module = getBackgroundSmsModule()
  if (!module) {
    return { enabled: false }
  }

  return module.getBackgroundSmsStateAsync()
}

export async function setBackgroundSmsEnabled(enabled: boolean): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) {
    return
  }

  await module.setBackgroundSmsEnabledAsync(enabled)
}

export async function loadBackgroundSmsReviewQueueSnapshot(): Promise<SmsImportReviewQueueSnapshot | null> {
  const module = getBackgroundSmsModule()
  if (!module) {
    return null
  }

  try {
    const raw = await module.getReviewQueueSnapshotJsonAsync()
    const parsed = JSON.parse(raw) as Partial<SmsImportReviewQueueSnapshot>

    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      lastScanCursor: parsed.lastScanCursor ?? null,
      bootstrapCompletedAt: parsed.bootstrapCompletedAt ?? null,
    }
  } catch {
    return null
  }
}

export async function saveBackgroundSmsReviewQueueSnapshot(
  snapshot: SmsImportReviewQueueSnapshot
): Promise<void> {
  const module = getBackgroundSmsModule()
  if (!module) {
    return
  }

  try {
    await module.replaceReviewQueueSnapshotJsonAsync(JSON.stringify(snapshot))
  } catch {
    // Keep the existing AsyncStorage-backed flow working even if the native mirror fails.
  }
}
