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
  it("normalizes sender, body, and whitespace before hashing", async () => {
    const first = await createSmsImportFingerprint(createMessage())
    const second = await createSmsImportFingerprint(
      createMessage({
        sender: "  vk-hdfcbk  ",
        body: "INR   499   spent  at  AMAZON Marketplace",
      })
    )

    expect(first).toBe(second)
  })

  it("treats messages within the same 3-minute window as the same candidate", async () => {
    const first = await createSmsImportFingerprint(
      createMessage({ receivedAt: "2026-04-11T10:15:01.000Z" })
    )
    const second = await createSmsImportFingerprint(
      createMessage({ receivedAt: "2026-04-11T10:17:59.000Z" })
    )

    expect(first).toBe(second)
  })

  it("treats messages in different 3-minute windows as distinct candidates", async () => {
    const first = await createSmsImportFingerprint(
      createMessage({ receivedAt: "2026-04-11T10:15:01.000Z" })
    )
    const second = await createSmsImportFingerprint(
      createMessage({ receivedAt: "2026-04-11T10:18:01.000Z" })
    )

    expect(first).not.toBe(second)
  })

  it("keeps exact duplicates stable", async () => {
    const first = await createSmsImportFingerprint(
      createMessage({ receivedAt: "2026-04-11T10:15:59.000Z" })
    )
    const second = await createSmsImportFingerprint(
      createMessage({ receivedAt: "2026-04-11T10:15:59.000Z" })
    )

    expect(first).toBe(second)
  })

  it("includes amount in the fingerprint when provided", async () => {
    const withoutAmount = await createSmsImportFingerprint(createMessage())
    const withAmount = await createSmsImportFingerprint(createMessage(), 499)

    expect(withoutAmount).not.toBe(withAmount)
  })

  it("normalizes amount to two decimal places", async () => {
    const amount499 = await createSmsImportFingerprint(createMessage(), 499)
    const amount49900 = await createSmsImportFingerprint(createMessage(), 499.0)

    expect(amount499).toBe(amount49900)
  })

  it("produces same fingerprint for same sender, body, time, and amount", async () => {
    const first = await createSmsImportFingerprint(createMessage(), 499)
    const second = await createSmsImportFingerprint(
      createMessage({
        sender: "  vk-hdfcbk  ",
        body: "INR   499   spent  at  AMAZON Marketplace",
      }),
      499
    )

    expect(first).toBe(second)
  })
})
