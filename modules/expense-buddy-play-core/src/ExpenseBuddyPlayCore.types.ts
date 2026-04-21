import { NativeModule } from "expo"

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

export interface NativePlayStoreUpdateInfo {
  availableVersionCode?: number | null
  clientVersionStalenessDays?: number | null
  installStatus?: string | null
  isFlexibleUpdateAllowed?: boolean | null
  isImmediateUpdateAllowed?: boolean | null
  updateAvailability?: string | null
  updatePriority?: number | null
}

export interface NativePlayStoreStatusEvent {
  bytesDownloaded?: number | null
  status?: string | null
  totalBytesToDownload?: number | null
}

export interface ExpenseBuddyPlayCoreNativeModule extends NativeModule {
  addListener(
    eventName: "onUpdateStatus",
    listener: (event: NativePlayStoreStatusEvent) => void
  ): { remove(): void }
  completeUpdateAsync(): Promise<void>
  getUpdateInfoAsync(): Promise<NativePlayStoreUpdateInfo>
  requestReviewAsync(): Promise<void>
  startFlexibleUpdateAsync(): Promise<void>
}
