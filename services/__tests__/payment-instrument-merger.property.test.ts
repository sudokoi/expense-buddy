/**
 * Property-based tests for Payment Instrument Merger
 */

import * as fc from "fast-check"
import type { PaymentInstrument } from "../../types/payment-instrument"
import { mergePaymentInstruments } from "../payment-instrument-merger"

const paymentInstrumentMethodArb = fc.constantFrom<PaymentInstrument["method"]>(
  "Credit Card",
  "Debit Card",
  "UPI"
)

const isoDateArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31
  .map((ts) => new Date(ts).toISOString())

const idArb = fc
  .string({ minLength: 1, maxLength: 24 })
  .filter((s) => s.trim().length > 0)

const digitsArb = fc
  .string({ minLength: 1, maxLength: 6 })
  .filter((s) => /^[0-9]+$/.test(s))

const nicknameArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0)

const instrumentArb = fc.record({
  id: idArb,
  method: paymentInstrumentMethodArb,
  nickname: nicknameArb,
  lastDigits: digitsArb,
  createdAt: isoDateArb,
  updatedAt: isoDateArb,
  deletedAt: fc.option(isoDateArb, { nil: undefined }),
})

function uniqById(list: PaymentInstrument[]): PaymentInstrument[] {
  const byId = new Map<string, PaymentInstrument>()
  for (const item of list) {
    // Keep the first occurrence; overlaps are controlled separately in tests.
    if (!byId.has(item.id)) byId.set(item.id, item)
  }
  return Array.from(byId.values())
}

describe("mergePaymentInstruments (properties)", () => {
  it("merged SHALL include union of ids and be sorted by id", () => {
    fc.assert(
      fc.property(
        fc.array(instrumentArb, { minLength: 0, maxLength: 20 }).map(uniqById),
        fc.array(instrumentArb, { minLength: 0, maxLength: 20 }).map(uniqById),
        (local, remote) => {
          const result = mergePaymentInstruments(local, remote)

          const union = new Set<string>([...local.map((i) => i.id), ...remote.map((i) => i.id)])
          expect(result.merged.map((i) => i.id).sort((a, b) => a.localeCompare(b))).toEqual(
            Array.from(union).sort((a, b) => a.localeCompare(b))
          )

          // sorted by id
          const ids = result.merged.map((i) => i.id)
          expect([...ids].sort((a, b) => a.localeCompare(b))).toEqual(ids)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("for overlapping ids, merged SHALL pick the newest updatedAt (tie -> remote)", () => {
    fc.assert(
      fc.property(
        fc.array(instrumentArb, { minLength: 0, maxLength: 15 }).map(uniqById),
        fc.array(instrumentArb, { minLength: 0, maxLength: 15 }).map(uniqById),
        // Force at least one overlap when possible by aligning one id
        fc.boolean(),
        (localBase, remoteBase, forceOverlap) => {
          const local = localBase
          let remote = remoteBase

          if (forceOverlap && local.length > 0) {
            const overlapId = local[0].id
            // Ensure remote has that id too
            const existingRemoteIdx = remote.findIndex((r) => r.id === overlapId)
            const remoteInst: PaymentInstrument =
              existingRemoteIdx >= 0
                ? remote[existingRemoteIdx]
                : {
                    ...local[0],
                    // Make it distinct
                    nickname: local[0].nickname + " r",
                    updatedAt: local[0].updatedAt,
                  }

            if (existingRemoteIdx >= 0) {
              remote = [...remote]
              remote[existingRemoteIdx] = remoteInst
            } else {
              remote = [remoteInst, ...remote]
            }
          }

          const result = mergePaymentInstruments(local, remote)
          const remoteById = new Map(remote.map((i) => [i.id, i]))
          const localById = new Map(local.map((i) => [i.id, i]))

          for (const id of new Set([...remoteById.keys(), ...localById.keys()])) {
            const l = localById.get(id)
            const r = remoteById.get(id)
            const m = result.merged.find((x) => x.id === id)
            expect(m).toBeDefined()
            if (!l || !r || !m) continue

            const newer = r.updatedAt > l.updatedAt ? r : l.updatedAt > r.updatedAt ? l : r
            // tie chooses remote
            expect(m.updatedAt).toBe(newer.updatedAt)
            expect(m.nickname).toBe(newer.nickname)
            expect(m.method).toBe(newer.method)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
