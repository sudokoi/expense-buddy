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

export interface NativeSmsCategoryPredictionRequest {
  messageId: string
  sender: string
  body: string
  merchantName?: string
}

export interface NativeSmsCategoryPrediction {
  messageId: string
  category: string
  confidence: number
  shouldUsePrediction: boolean
  modelId: string
}

export interface NativeSmsScanParseResult {
  fingerprint: string
  messageId: string
  sender: string
  body: string
  receivedAt: string
  amount: number | null
  currency: string | null
  merchantName: string | null
  categorySuggestion: string | null
  categorySuggestionSource: string | null
  categorySuggestionConfidence: number | null
  categorySuggestionModelId: string | null
  paymentMethodType: string | null
  paymentMethodIdentifier: string | null
  paymentMethodInstrumentId: string | null
  noteSuggestion: string | null
  transactionDate: string | null
  matchedLocale: string | null
  matchedPatternKey: string | null
}

export interface ExpenseBuddySmsImportNativeModule extends NativeModule {
  getPermissionStatusAsync(): Promise<SmsImportPermissionResponse>
  requestPermissionAsync(): Promise<SmsImportPermissionResponse>
  scanMessagesAsync(options?: SmsImportScanOptions): Promise<NativeSmsImportMessage[]>
  scanAndParseMessagesAsync(
    options?: SmsImportScanOptions,
    useMlOnly?: boolean
  ): Promise<NativeSmsScanParseResult[]>
  categorizeMessagesAsync?(
    requests: NativeSmsCategoryPredictionRequest[]
  ): Promise<NativeSmsCategoryPrediction[]>
}
