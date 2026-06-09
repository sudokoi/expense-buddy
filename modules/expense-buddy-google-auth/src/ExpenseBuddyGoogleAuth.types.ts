import { NativeModule } from "expo"

export interface GoogleDriveNativeAuthResult {
  serverAuthCode: string
  email: string
}

export interface ExpenseBuddyGoogleAuthNativeModule extends NativeModule {
  startGoogleDriveOAuthAsync(
    webClientId: string
  ): Promise<GoogleDriveNativeAuthResult | null>
}
