import { NativeModule } from "expo"

export interface LogEntryDto {
  timestamp: number
  level: string
  tag: string
  message: string
  stacktrace: string | null
}

export interface ExpenseBuddyLoggerNativeModule extends NativeModule {
  logAsync(
    level: string,
    tag: string,
    message: string,
    stacktrace: string | null
  ): Promise<void>
  getLogsAsync(count: number): Promise<LogEntryDto[]>
  getLogsAsStringAsync(count: number): Promise<string>
  clearLogsAsync(): Promise<void>
}
