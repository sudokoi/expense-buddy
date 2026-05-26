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

function hashString(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash).toString(36)
}

function getTimeWindow(receivedAt: string): number {
  const timestamp = new Date(receivedAt).getTime()
  if (Number.isNaN(timestamp)) {
    return 0
  }

  const WINDOW_MS = 3 * 60 * 1000
  return Math.floor(timestamp / WINDOW_MS) * WINDOW_MS
}

export function createSmsImportFingerprint(message: SmsImportRawMessage): string {
  const normalizedSender = normalizeWhitespace(message.sender).toLowerCase()
  const normalizedBody = normalizeWhitespace(message.body).toLowerCase()
  const timeWindow = getTimeWindow(message.receivedAt)

  return `sms_${hashString(`${normalizedSender}|${normalizedBody}|${timeWindow}`)}`
}
