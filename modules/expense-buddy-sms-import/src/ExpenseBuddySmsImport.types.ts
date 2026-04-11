import { NativeModule } from "expo"

export type SmsImportPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "unavailable"

export interface SmsImportPermissionResponse {
  status: SmsImportPermissionStatus
  granted: boolean
  canAskAgain: boolean
  expires: "never"
}

export interface SmsImportScanOptions {
  since?: string
  limit?: number
  lookbackDays?: number
}

export interface NativeSmsImportMessage {
  messageId: string
  sender: string
  body: string
  receivedAt: string
}

export interface ExpenseBuddySmsImportNativeModule extends NativeModule {
  getPermissionStatusAsync(): Promise<SmsImportPermissionResponse>
  requestPermissionAsync(): Promise<SmsImportPermissionResponse>
  scanMessagesAsync(options?: SmsImportScanOptions): Promise<NativeSmsImportMessage[]>
}
