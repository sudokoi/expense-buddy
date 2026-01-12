import * as fc from "fast-check"
import { computeVersionCode } from "./version-code"

const stageLabelArb = fc.constantFrom(
  "dev",
  "canary",
  "snapshot",
  "alpha",
  "beta",
  "rc",
  "pre",
  "preview",
  "prerelease",
  // include a few unknown labels to ensure we still generate a valid code
  "nightly",
  "foo"
)

const numericPartArb = fc.integer({ min: 0, max: 99 })

const coreSemverArb = fc
  .tuple(
    // keep MAJOR bounded so versionCode stays in range
    fc.integer({ min: 0, max: 99 }),
    numericPartArb,
    numericPartArb
  )
  .map(([major, minor, patch]) => ({ major, minor, patch }))

describe("versionCode semver properties", () => {
  it("stable versions SHALL map to a valid positive integer", () => {
    fc.assert(
      fc.property(coreSemverArb, ({ major, minor, patch }) => {
        // Avoid 0.0.0 because Android versionCode must be > 0
        if (major === 0 && minor === 0 && patch === 0) return true

        const v = `${major}.${minor}.${patch}`
        const code = computeVersionCode(v)

        expect(Number.isInteger(code)).toBe(true)
        expect(code).toBeGreaterThan(0)
        expect(code).toBeLessThan(2100000000)
        return true
      }),
      { numRuns: 200 }
    )
  })

  it("a leading 'v' prefix SHALL NOT change the computed versionCode", () => {
    fc.assert(
      fc.property(coreSemverArb, ({ major, minor, patch }) => {
        if (major === 0 && minor === 0 && patch === 0) return true

        const v = `${major}.${minor}.${patch}`
        expect(computeVersionCode(`v${v}`)).toBe(computeVersionCode(v))
        return true
      }),
      { numRuns: 200 }
    )
  })

  it("stable releases SHALL sort higher than prereleases for the same MAJOR.MINOR.PATCH", () => {
    fc.assert(
      fc.property(
        coreSemverArb,
        stageLabelArb,
        numericPartArb,
        ({ major, minor, patch }, label, seq) => {
          if (major === 0 && minor === 0 && patch === 0) return true

          const stable = computeVersionCode(`${major}.${minor}.${patch}`)
          const pre = computeVersionCode(`${major}.${minor}.${patch}-${label}.${seq}`)

          expect(stable).toBeGreaterThan(pre)
          return true
        }
      ),
      { numRuns: 300 }
    )
  })

  it("changing prerelease sequence SHALL change versionCode (uniqueness)", () => {
    fc.assert(
      fc.property(
        coreSemverArb,
        stageLabelArb,
        fc.integer({ min: 0, max: 98 }),
        ({ major, minor, patch }, label, seq) => {
          if (major === 0 && minor === 0 && patch === 0) return true

          const v1 = `${major}.${minor}.${patch}-${label}.${seq}`
          const v2 = `${major}.${minor}.${patch}-${label}.${seq + 1}`

          const c1 = computeVersionCode(v1)
          const c2 = computeVersionCode(v2)

          expect(c1).not.toBe(c2)
          expect(c2).toBeGreaterThan(c1)
          return true
        }
      ),
      { numRuns: 300 }
    )
  })
})
