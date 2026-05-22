import { NativeModule } from "expo"

export interface BackgroundSmsState {
  enabled: boolean
}

export interface ExpenseBuddyBackgroundSmsNativeModule extends NativeModule {
  getBackgroundSmsStateAsync(): Promise<BackgroundSmsState>
  setBackgroundSmsEnabledAsync(enabled: boolean): Promise<void>
  getReviewQueueSnapshotJsonAsync(): Promise<string>
  replaceReviewQueueSnapshotJsonAsync(snapshotJson: string): Promise<void>
}
