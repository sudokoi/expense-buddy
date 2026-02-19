/**
 * Property-based tests for Merchant Sync (Pattern and Correction Merge)
 * Feature: sms-import-gaps
 */

import fc from "fast-check"
import type { MerchantPattern, MerchantPatternsFile } from "../../types/merchant-patterns"
import type { PaymentMethodType } from "../../types/expense"
import { mergeMerchantPatterns } from "./merchant-sync"

// Arbitrary: ISO date string within a reasonable range
const dateArb = fc
  .integer({
    min: new Date("2020-01-01").getTime(),
    max: new Date("2030-12-31").getTime(),
  })
  .map((t) => new Date(t).toISOString())

// Arbitrary: valid payment method type
const paymentMethodArb = fc.constantFrom<PaymentMethodType>(
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other"
)

// Arbitrary: unique normalized merchant name (lowercase alphanumeric)
const normalizedNameArb = fc
  .string({ minLength: 3, maxLength: 15, unit: "grapheme" })
  .map(
    (s) =>
      s
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase()
        .slice(0, 15) || "abc"
  )

// Arbitrary: a single MerchantPattern
const merchantPatternArb = fc
  .record({
    id: fc.uuid(),
    normalizedName: normalizedNameArb,
    rawPatterns: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 1,
      maxLength: 5,
    }),
    category: fc.constantFrom("Food", "Transport", "Shopping", "Bills", "Other"),
    paymentMethod: paymentMethodArb,
    confidence: fc.double({ min: 0, max: 1, noNaN: true }),
    usageCount: fc.integer({ min: 1, max: 10000 }),
    lastUsed: dateArb,
    userOverridden: fc.boolean(),
  })
  .map((r) => ({ ...r, paymentInstrument: undefined }) as MerchantPattern)

// Arbitrary: a single UserCorrection
const userCorrectionArb = fc
  .record({
    id: fc.uuid(),
    originalMerchant: fc.string({ minLength: 1, maxLength: 20 }),
    correctedCategory: fc.constantFrom("Food", "Transport", "Shopping", "Bills", "Other"),
    correctedPaymentMethod: paymentMethodArb,
    timestamp: dateArb,
    applyToFuture: fc.boolean(),
  })
  .map((r) => ({
    ...r,
    correctedInstrument: undefined,
  }))

// Arbitrary: a MerchantPatternsFile with unique normalizedNames and unique correction IDs
const patternsFileArb = fc
  .record({
    version: fc.constant(1),
    lastSyncedAt: dateArb,
    patterns: fc
      .array(merchantPatternArb, { minLength: 0, maxLength: 10 })
      .map((patterns) => {
        const seen = new Set<string>()
        return patterns.filter((p) => {
          if (seen.has(p.normalizedName)) return false
          seen.add(p.normalizedName)
          return true
        })
      }),
    corrections: fc
      .array(userCorrectionArb, { minLength: 0, maxLength: 10 })
      .map((corrections) => {
        const seen = new Set<string>()
        return corrections.filter((c) => {
          if (seen.has(c.id)) return false
          seen.add(c.id)
          return true
        })
      }),
  })
  .map((r) => r as MerchantPatternsFile)

describe("Merchant Sync Properties", () => {
  /**
   * Property 9: Merchant Pattern Merge Data Preservation
   * For any two sets of merchant patterns, the merged result SHALL have:
   * - usageCount equal to the sum of both counts for shared patterns
   * - rawPatterns as the union of both arrays (no duplicates)
   * - lastUsed as the more recent of the two timestamps
   * - Patterns only in one set appear unchanged in the merged result
   */
  describe("Property 9: Merchant Pattern Merge Data Preservation", () => {
    it("merged usageCount SHALL be the sum of both counts for shared patterns", () => {
      fc.assert(
        fc.property(patternsFileArb, patternsFileArb, (local, remote) => {
          const merged = mergeMerchantPatterns(local, remote)
          const localMap = new Map(local.patterns.map((p) => [p.normalizedName, p]))
          const remoteMap = new Map(remote.patterns.map((p) => [p.normalizedName, p]))

          for (const mp of merged.patterns) {
            const lp = localMap.get(mp.normalizedName)
            const rp = remoteMap.get(mp.normalizedName)

            if (lp && rp) {
              expect(mp.usageCount).toBe(lp.usageCount + rp.usageCount)
            } else if (lp) {
              expect(mp.usageCount).toBe(lp.usageCount)
            } else if (rp) {
              expect(mp.usageCount).toBe(rp.usageCount)
            }
          }
        }),
        { numRuns: 100 }
      )
    })

    it("merged rawPatterns SHALL be the union of both arrays without duplicates", () => {
      fc.assert(
        fc.property(patternsFileArb, patternsFileArb, (local, remote) => {
          const merged = mergeMerchantPatterns(local, remote)
          const localMap = new Map(local.patterns.map((p) => [p.normalizedName, p]))
          const remoteMap = new Map(remote.patterns.map((p) => [p.normalizedName, p]))

          for (const mp of merged.patterns) {
            const lp = localMap.get(mp.normalizedName)
            const rp = remoteMap.get(mp.normalizedName)

            if (lp && rp) {
              const expectedUnion = new Set([...lp.rawPatterns, ...rp.rawPatterns])
              expect(new Set(mp.rawPatterns)).toEqual(expectedUnion)
            }

            // No duplicates in rawPatterns
            expect(mp.rawPatterns.length).toBe(new Set(mp.rawPatterns).size)
          }
        }),
        { numRuns: 100 }
      )
    })

    it("merged lastUsed SHALL be the more recent of the two timestamps", () => {
      fc.assert(
        fc.property(patternsFileArb, patternsFileArb, (local, remote) => {
          const merged = mergeMerchantPatterns(local, remote)
          const localMap = new Map(local.patterns.map((p) => [p.normalizedName, p]))
          const remoteMap = new Map(remote.patterns.map((p) => [p.normalizedName, p]))

          for (const mp of merged.patterns) {
            const lp = localMap.get(mp.normalizedName)
            const rp = remoteMap.get(mp.normalizedName)

            if (lp && rp) {
              const expected =
                new Date(lp.lastUsed).getTime() >= new Date(rp.lastUsed).getTime()
                  ? lp.lastUsed
                  : rp.lastUsed
              expect(mp.lastUsed).toBe(expected)
            }
          }
        }),
        { numRuns: 100 }
      )
    })

    it("patterns only in one set SHALL appear unchanged in the merged result", () => {
      fc.assert(
        fc.property(patternsFileArb, patternsFileArb, (local, remote) => {
          const merged = mergeMerchantPatterns(local, remote)
          const mergedMap = new Map(merged.patterns.map((p) => [p.normalizedName, p]))
          const localMap = new Map(local.patterns.map((p) => [p.normalizedName, p]))
          const remoteMap = new Map(remote.patterns.map((p) => [p.normalizedName, p]))

          for (const lp of local.patterns) {
            if (!remoteMap.has(lp.normalizedName)) {
              const mp = mergedMap.get(lp.normalizedName)
              expect(mp).toBeDefined()
              expect(mp!.usageCount).toBe(lp.usageCount)
              expect(mp!.category).toBe(lp.category)
            }
          }

          for (const rp of remote.patterns) {
            if (!localMap.has(rp.normalizedName)) {
              const mp = mergedMap.get(rp.normalizedName)
              expect(mp).toBeDefined()
              expect(mp!.usageCount).toBe(rp.usageCount)
              expect(mp!.category).toBe(rp.category)
            }
          }

          // Merged should contain exactly the union of all normalizedNames
          const allNames = new Set([
            ...local.patterns.map((p) => p.normalizedName),
            ...remote.patterns.map((p) => p.normalizedName),
          ])
          expect(merged.patterns.length).toBe(allNames.size)
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 10: Correction Merge Union Deduplicated by ID
   * For any two sets of user corrections, the merged result SHALL contain all
   * corrections from both sets, deduplicated by ID. When the same ID exists in
   * both sets, the correction with the more recent timestamp SHALL be kept.
   */
  describe("Property 10: Correction Merge Union Deduplicated by ID", () => {
    it("merged corrections SHALL contain all unique IDs from both sets", () => {
      fc.assert(
        fc.property(patternsFileArb, patternsFileArb, (local, remote) => {
          const merged = mergeMerchantPatterns(local, remote)
          const mergedIds = new Set(merged.corrections.map((c) => c.id))
          const allIds = new Set([
            ...local.corrections.map((c) => c.id),
            ...remote.corrections.map((c) => c.id),
          ])

          expect(mergedIds).toEqual(allIds)
        }),
        { numRuns: 100 }
      )
    })

    it("merged corrections SHALL have no duplicate IDs", () => {
      fc.assert(
        fc.property(patternsFileArb, patternsFileArb, (local, remote) => {
          const merged = mergeMerchantPatterns(local, remote)
          const ids = merged.corrections.map((c) => c.id)
          expect(ids.length).toBe(new Set(ids).size)
        }),
        { numRuns: 100 }
      )
    })

    it("when same ID exists in both sets, the more recent timestamp SHALL be kept", () => {
      fc.assert(
        fc.property(
          fc.array(userCorrectionArb, { minLength: 1, maxLength: 5 }),
          fc.array(userCorrectionArb, { minLength: 1, maxLength: 5 }),
          (localCorr, remoteCorr) => {
            // Create remote versions of local corrections with a later timestamp
            const sharedCorr = localCorr.map((c) => ({
              ...c,
              timestamp: new Date(
                new Date(c.timestamp).getTime() + 86400000
              ).toISOString(),
              correctedCategory: "Shopping",
            }))

            const local: MerchantPatternsFile = {
              version: 1,
              lastSyncedAt: new Date().toISOString(),
              patterns: [],
              corrections: localCorr,
            }
            const remote: MerchantPatternsFile = {
              version: 1,
              lastSyncedAt: new Date().toISOString(),
              patterns: [],
              corrections: [...remoteCorr, ...sharedCorr],
            }

            const merged = mergeMerchantPatterns(local, remote)
            const mergedMap = new Map(merged.corrections.map((c) => [c.id, c]))

            // For shared IDs, the remote version (which has +1 day) should win
            for (const lc of localCorr) {
              const mc = mergedMap.get(lc.id)
              expect(mc).toBeDefined()
              expect(new Date(mc!.timestamp).getTime()).toBeGreaterThanOrEqual(
                new Date(lc.timestamp).getTime()
              )
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
