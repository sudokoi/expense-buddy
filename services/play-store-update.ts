import { Platform } from "react-native"
import ExpenseBuddyPlayCoreModule, {
  type ExpenseBuddyPlayCoreNativeModule,
  type NativePlayStoreUpdateInfo,
  type PlayStoreInstallStatus,
  type PlayStoreUpdateAvailability,
} from "../modules/expense-buddy-play-core"

export type { PlayStoreInstallStatus, PlayStoreUpdateAvailability }

export interface PlayStoreUpdateInfo {
  availableVersionCode?: number
  clientVersionStalenessDays?: number | null
  installStatus: PlayStoreInstallStatus
  isFlexibleUpdateAllowed: boolean
  isImmediateUpdateAllowed: boolean
  updateAvailability: PlayStoreUpdateAvailability
  updatePriority?: number
}

export interface PlayStoreUpdateStatusEvent {
  bytesDownloaded?: number
  status: PlayStoreInstallStatus
  totalBytesToDownload?: number
}

let moduleOverride: ExpenseBuddyPlayCoreNativeModule | null = null

export function setPlayStoreCoreModuleForTesting(
  nextModule: ExpenseBuddyPlayCoreNativeModule | null
): void {
  moduleOverride = nextModule
}

function getModule(): ExpenseBuddyPlayCoreNativeModule {
  if (Platform.OS !== "android") {
    throw new Error("Play Store in-app updates are unavailable in this build")
  }

  const installedModule = moduleOverride ?? ExpenseBuddyPlayCoreModule
  if (!installedModule) {
    throw new Error("Play Store core module is not registered yet")
  }

  return installedModule
}

function normalizeAvailability(
  availability: string | null | undefined
): PlayStoreUpdateAvailability {
  switch (availability) {
    case "available":
    case "in_progress":
    case "not_available":
      return availability
    default:
      return "unknown"
  }
}

function normalizeInstallStatus(
  status: string | null | undefined
): PlayStoreInstallStatus {
  switch (status) {
    case "accepted":
    case "canceled":
    case "downloaded":
    case "downloading":
    case "failed":
    case "installed":
    case "installing":
    case "pending":
    case "requires_ui_intent":
      return status
    default:
      return "unknown"
  }
}

function normalizeUpdateInfo(rawInfo: NativePlayStoreUpdateInfo): PlayStoreUpdateInfo {
  const availableVersionCode =
    typeof rawInfo.availableVersionCode === "number" && rawInfo.availableVersionCode > 0
      ? rawInfo.availableVersionCode
      : undefined

  return {
    availableVersionCode,
    clientVersionStalenessDays:
      typeof rawInfo.clientVersionStalenessDays === "number"
        ? rawInfo.clientVersionStalenessDays
        : null,
    installStatus: normalizeInstallStatus(rawInfo.installStatus),
    isFlexibleUpdateAllowed: rawInfo.isFlexibleUpdateAllowed === true,
    isImmediateUpdateAllowed: rawInfo.isImmediateUpdateAllowed === true,
    updateAvailability: normalizeAvailability(rawInfo.updateAvailability),
    updatePriority:
      typeof rawInfo.updatePriority === "number" ? rawInfo.updatePriority : undefined,
  }
}

export async function getPlayStoreUpdateInfo(): Promise<PlayStoreUpdateInfo> {
  const nativeInfo = await getModule().getUpdateInfoAsync()
  return normalizeUpdateInfo(nativeInfo)
}

export async function startPlayStoreFlexibleUpdate(): Promise<void> {
  await getModule().startFlexibleUpdateAsync()
}

export async function completePlayStoreUpdate(): Promise<void> {
  await getModule().completeUpdateAsync()
}

export function subscribeToPlayStoreUpdateStatus(
  listener: (event: PlayStoreUpdateStatusEvent) => void
): () => void {
  if (Platform.OS !== "android") {
    return () => {}
  }

  const subscription = getModule().addListener("onUpdateStatus", (event) => {
    listener({
      bytesDownloaded:
        typeof event.bytesDownloaded === "number" ? event.bytesDownloaded : undefined,
      status: normalizeInstallStatus(event.status),
      totalBytesToDownload:
        typeof event.totalBytesToDownload === "number"
          ? event.totalBytesToDownload
          : undefined,
    })
  })

  return () => {
    subscription.remove()
  }
}
