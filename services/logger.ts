import { Platform } from "react-native"
import ExpenseBuddyLoggerModule from "../modules/expense-buddy-logger"

const module = Platform.OS === "android" ? ExpenseBuddyLoggerModule : null

export async function logAsync(
  level: "DEBUG" | "INFO" | "WARN" | "ERROR",
  tag: string,
  message: string,
  stacktrace?: string | null
): Promise<void> {
  if (!module) return
  await module.logAsync(level, tag, message, stacktrace ?? null).catch(() => {})
}

export async function getLogsForBugReportAsync(count: number = 200): Promise<string> {
  if (!module) return ""
  return module.getLogsAsStringAsync(count).catch(() => "")
}

export async function clearLogsAsync(): Promise<void> {
  if (!module) return
  await module.clearLogsAsync().catch(() => {})
}
