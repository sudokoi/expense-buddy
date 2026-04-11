import { createSmsImportFingerprint } from "./fingerprint"
import type { SmsImportRawMessage } from "../../types/sms-import"

function createMessage(
  overrides: Partial<SmsImportRawMessage> = {}
): SmsImportRawMessage {
  return {
    messageId: "sms-1",
    sender: "VK-HDFCBK",
    body: "INR 499 spent at Amazon Marketplace",
    receivedAt: "2026-04-11T10:15:45.000Z",
    ...overrides,
  }
}

describe("createSmsImportFingerprint", () => {
  it("normalizes sender, body, and whitespace before hashing", () => {
    const first = createSmsImportFingerprint(createMessage())
    const second = createSmsImportFingerprint(
      createMessage({
        sender: "  vk-hdfcbk  ",
        body: "INR   499   spent  at  AMAZON Marketplace",
      })
    )

    expect(first).toBe(second)
  })

  it("uses minute buckets so messages in the same minute dedupe together", () => {
    const first = createSmsImportFingerprint(
      createMessage({ receivedAt: "2026-04-11T10:15:01.000Z" })
    )
    const second = createSmsImportFingerprint(
      createMessage({ receivedAt: "2026-04-11T10:15:59.000Z" })
    )

    expect(first).toBe(second)
  })

  it("changes when the message falls in a different minute bucket", () => {
    const first = createSmsImportFingerprint(
      createMessage({ receivedAt: "2026-04-11T10:15:59.000Z" })
    )
    const second = createSmsImportFingerprint(
      createMessage({ receivedAt: "2026-04-11T10:16:00.000Z" })
    )

    expect(first).not.toBe(second)
  })
})
