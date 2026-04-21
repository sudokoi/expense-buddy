import { NativeEventEmitter, NativeModules, Platform } from "react-native"

export type PlayStoreUpdateAvailability =
  | "available"
  | "in_progress"
  | "not_available"
  | "unknown"

export type PlayStoreInstallStatus =
  | "accepted"
  | "canceled"
  | "downloaded"
  | "downloading"
  | "failed"
  | "installed"
  | "installing"
  | "pending"
  | "requires_ui_intent"
  | "unknown"

interface NativePlayStoreUpdateInfo {
  availableVersionCode?: number | null
  clientVersionStalenessDays?: number | null
  installStatus?: string | null
  isFlexibleUpdateAllowed?: boolean | null
  isImmediateUpdateAllowed?: boolean | null
  updateAvailability?: string | null
  updatePriority?: number | null
}

interface NativePlayStoreStatusEvent {
  bytesDownloaded?: number | null
  status?: string | null
  totalBytesToDownload?: number | null
}

interface PlayStoreUpdateModuleShape {
  addListener(eventName: string): void
  completeUpdate(): Promise<void>
  getUpdateInfo(): Promise<NativePlayStoreUpdateInfo>
  removeListeners(count: number): void
  startFlexibleUpdate(): Promise<void>
}

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

const STATUS_EVENT_NAME = "playStoreUpdateStatus"

const playStoreUpdateModule = NativeModules?.PlayStoreUpdateModule as
  | PlayStoreUpdateModuleShape
  | undefined

function getModule(): PlayStoreUpdateModuleShape {
  if (Platform.OS !== "android" || !playStoreUpdateModule) {
    throw new Error("Play Store in-app updates are unavailable in this build")
  }

  return playStoreUpdateModule
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
  const nativeInfo = await getModule().getUpdateInfo()
  return normalizeUpdateInfo(nativeInfo)
}

export async function startPlayStoreFlexibleUpdate(): Promise<void> {
  await getModule().startFlexibleUpdate()
}

export async function completePlayStoreUpdate(): Promise<void> {
  await getModule().completeUpdate()
}

export function subscribeToPlayStoreUpdateStatus(
  listener: (event: PlayStoreUpdateStatusEvent) => void
): () => void {
  if (Platform.OS !== "android" || !playStoreUpdateModule) {
    return () => {}
  }

  if (typeof NativeEventEmitter !== "function") {
    return () => {}
  }

  const emitter = new NativeEventEmitter(playStoreUpdateModule)
  const subscription = emitter.addListener(
    STATUS_EVENT_NAME,
    (event: NativePlayStoreStatusEvent) => {
      listener({
        bytesDownloaded:
          typeof event.bytesDownloaded === "number" ? event.bytesDownloaded : undefined,
        status: normalizeInstallStatus(event.status),
        totalBytesToDownload:
          typeof event.totalBytesToDownload === "number"
            ? event.totalBytesToDownload
            : undefined,
      })
    }
  )

  return () => {
    subscription.remove()
  }
}
