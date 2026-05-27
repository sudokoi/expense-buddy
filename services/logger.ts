import { Platform } from "react-native"
import ExpenseBuddyLoggerModule from "../modules/expense-buddy-logger"

const module = Platform.OS === "android" ? ExpenseBuddyLoggerModule : null

let patched = false

export function patchConsole(): void {
  if (patched || !module) return
  patched = true

  const origWarn = console.warn
  const origError = console.error

  console.warn = (...args: unknown[]) => {
    module?.logAsync("WARN", "CONSOLE", args.map(String).join(" "), null).catch(() => {})
    origWarn.apply(console, args)
  }

  console.error = (...args: unknown[]) => {
    const stacktrace =
      args.length > 0 && args[args.length - 1] instanceof Error
        ? ((args[args.length - 1] as Error).stack ?? null)
        : null
    module
      ?.logAsync("ERROR", "CONSOLE", args.map(String).join(" "), stacktrace)
      .catch(() => {})
    origError.apply(console, args)
  }
}

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
