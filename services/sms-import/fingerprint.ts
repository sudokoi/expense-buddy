import { SmsImportRawMessage } from "../../types/sms-import"

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function hashString(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash).toString(36)
}

export function createSmsImportFingerprint(message: SmsImportRawMessage): string {
  const normalizedSender = normalizeWhitespace(message.sender).toLowerCase()
  const normalizedBody = normalizeWhitespace(message.body).toLowerCase()

  return `sms_${hashString(`${normalizedSender}|${normalizedBody}|${message.receivedAt}`)}`
}
