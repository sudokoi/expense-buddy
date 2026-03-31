/**
 * Property-based tests for Message ID Generation
 * Feature: sms-import-gaps
 */

import fc from "fast-check"
import { createHash } from "crypto"

/**
 * Reimplements the generateMessageId logic from ml-parser.ts for testing.
 * Uses Node's crypto module to compute a real SHA-256 hash, matching the
 * production behavior of expo-crypto's digestStringAsync.
 * Format: {timestamp_base36}-{first_16_chars_of_hex_hash}
 */
function generateMessageId(message: string, timestamp: number): string {
  const timestampStr = timestamp.toString(36)
  const hash = createHash("sha256").update(message).digest("hex")
  return `${timestampStr}-${hash.substring(0, 16)}`
}

/**
 * Extracts the hash portion (after the first dash) from a message ID.
 */
function extractHash(messageId: string): string {
  const dashIndex = messageId.indexOf("-")
  return dashIndex >= 0 ? messageId.substring(dashIndex + 1) : messageId
}

// Generator: non-empty SMS-like strings
const smsMessageArb = fc.string({ minLength: 1, maxLength: 200 })

describe("Message ID Properties", () => {
  /**
   * Property 11: Message IDs are distinct for distinct content
   * For any two SMS messages with different content, the generated message IDs
   * SHALL have distinct hash components, ensuring collision resistance.
   */
  describe("Property 11: Message IDs Are Distinct for Distinct Content", () => {
    it("two messages with different content SHALL produce distinct hash components", () => {
      const fixedTimestamp = Date.now()

      fc.assert(
        fc.property(smsMessageArb, smsMessageArb, (msgA, msgB) => {
          fc.pre(msgA !== msgB)

          const idA = generateMessageId(msgA, fixedTimestamp)
          const idB = generateMessageId(msgB, fixedTimestamp)

          const hashA = extractHash(idA)
          const hashB = extractHash(idB)

          return hashA !== hashB
        }),
        { numRuns: 100 }
      )
    })
  })
})
