import { Platform } from "react-native"
import { SmsImportRawMessage } from "../../types/sms-import"
import ExpenseBuddySmsImportModule, {
  NativeSmsImportMessage,
  SmsImportPermissionResponse,
  SmsImportScanOptions,
} from "../../modules/expense-buddy-sms-import"

export type SmsImportPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "unavailable"

export interface AndroidSmsModule {
  getPermissionStatusAsync(): Promise<SmsImportPermissionResponse>
  requestPermissionAsync(): Promise<SmsImportPermissionResponse>
  scanMessagesAsync(options: SmsImportScanOptions): Promise<NativeSmsImportMessage[]>
}

let moduleOverride: AndroidSmsModule | null = null

export function setAndroidSmsModuleForTesting(nextModule: AndroidSmsModule | null): void {
  moduleOverride = nextModule
}

function getAndroidSmsModule(): AndroidSmsModule {
  if (Platform.OS !== "android") {
    throw new Error("SMS import is only supported on Android")
  }

  const installedModule = moduleOverride ?? ExpenseBuddySmsImportModule
  if (!installedModule) {
    throw new Error("Android SMS module is not registered yet")
  }

  return installedModule
}

export async function getSmsPermissionStatus(): Promise<SmsImportPermissionStatus> {
  return (await getAndroidSmsModule().getPermissionStatusAsync()).status
}

export async function requestSmsPermission(): Promise<SmsImportPermissionStatus> {
  return (await getAndroidSmsModule().requestPermissionAsync()).status
}

function normalizeNativeMessage(message: NativeSmsImportMessage): SmsImportRawMessage {
  return {
    messageId: message.messageId,
    sender: message.sender,
    body: message.body,
    receivedAt: message.receivedAt,
  }
}

export async function scanRecentSmsMessages(
  options: SmsImportScanOptions = {}
): Promise<SmsImportRawMessage[]> {
  const messages = await getAndroidSmsModule().scanMessagesAsync({
    lookbackDays: 7,
    ...options,
  })

  return messages
    .map(normalizeNativeMessage)
    .sort(
      (left, right) =>
        new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime()
    )
}
