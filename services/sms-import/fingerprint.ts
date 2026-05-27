import { SmsImportRawMessage } from "../../types/sms-import"

function normalizeUnicode(value: string): string {
  try {
    return value.normalize("NFKD")
  } catch {
    return value
  }
}

function normalizeWhitespace(value: string): string {
  return normalizeUnicode(value).replace(/\s+/g, " ").trim()
}

function getTimeWindow(receivedAt: string): number {
  const timestamp = new Date(receivedAt).getTime()
  if (Number.isNaN(timestamp)) {
    return 0
  }

  const WINDOW_MS = 3 * 60 * 1000
  return Math.floor(timestamp / WINDOW_MS) * WINDOW_MS
}

function normalizeAmount(value: number | undefined): string {
  if (value == null) return ""
  return value.toFixed(2)
}

async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function createSmsImportFingerprint(
  message: SmsImportRawMessage,
  amount?: number
): Promise<string> {
  const normalizedSender = normalizeWhitespace(message.sender).toLowerCase()
  const normalizedBody = normalizeWhitespace(message.body).toLowerCase()
  const normalizedAmount = normalizeAmount(amount)
  const timeWindow = getTimeWindow(message.receivedAt)

  const key = `${normalizedSender}|${normalizedAmount}|${timeWindow}|${normalizedBody}`
  const hash = await sha256(key)
  return `sms_${hash}`
}
