import { Platform } from "react-native"

import ExpenseBuddyUtilsModule, {
  type ArchiveEntryDto,
  type ExpenseBuddyUtilsNativeModule,
} from "../modules/expense-buddy-utils"

let moduleOverride: ExpenseBuddyUtilsNativeModule | null = null

export function __setArchiveUtilsModuleForTests(
  nextModule: ExpenseBuddyUtilsNativeModule | null
): void {
  moduleOverride = nextModule
}

function getModule(): ExpenseBuddyUtilsNativeModule | null {
  if (moduleOverride) {
    return moduleOverride
  }

  if (Platform.OS !== "android") {
    return null
  }

  return ExpenseBuddyUtilsModule
}

export interface ArchiveTextEntry {
  path: string
  content: string
}

function ensureModule(): ExpenseBuddyUtilsNativeModule {
  const module = getModule()
  if (!module) {
    throw new Error("Archive utilities are only available on Android")
  }
  return module
}

export async function zipTextEntriesAsync(entries: ArchiveTextEntry[]): Promise<string> {
  const module = ensureModule()
  const normalizedEntries: ArchiveEntryDto[] = entries.map((entry) => ({
    path: entry.path,
    content: entry.content,
  }))
  return await module.zipTextEntriesAsync(normalizedEntries)
}

export async function unzipTextEntriesAsync(
  archiveBase64: string
): Promise<ArchiveTextEntry[]> {
  const module = ensureModule()
  return await module.unzipTextEntriesAsync(archiveBase64)
}
