/**
 * Property-based tests for changelog-on-update gating logic
 * Feature: in-app-changelog
 */

import * as fc from "fast-check"
import { shouldOpenChangelogModal } from "./changelog-gating"

describe("useChangelogOnUpdate properties", () => {
  const versionArb = fc
    .tuple(
      fc.integer({ min: 0, max: 99 }),
      fc.integer({ min: 0, max: 99 }),
      fc.integer({ min: 0, max: 99 })
    )
    .map(([major, minor, patch]) => `${major}.${minor}.${patch}`)

  const nonEmptyNotesArb = fc.string().filter((s) => s.trim().length > 0)

  const whitespaceNotesArb = fc
    .array(fc.constantFrom(" ", "\n", "\t", "\r"), { minLength: 1 })
    .map((chars) => chars.join(""))

  it("SHALL never open in dev", () => {
    fc.assert(
      fc.property(
        versionArb,
        fc.option(versionArb, { nil: null }),
        nonEmptyNotesArb,
        (currentVersion, lastSeenVersion, releaseNotes) => {
          expect(
            shouldOpenChangelogModal({
              isDev: true,
              updateAvailable: false,
              updateCheckCompleted: true,
              currentVersion,
              lastSeenVersion,
              releaseNotes,
            })
          ).toBe(false)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("SHALL not open before update check completes", () => {
    fc.assert(
      fc.property(
        versionArb,
        fc.option(versionArb, { nil: null }),
        nonEmptyNotesArb,
        (currentVersion, lastSeenVersion, releaseNotes) => {
          expect(
            shouldOpenChangelogModal({
              isDev: false,
              updateAvailable: false,
              updateCheckCompleted: false,
              currentVersion,
              lastSeenVersion,
              releaseNotes,
            })
          ).toBe(false)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("SHALL not open when an update is available", () => {
    fc.assert(
      fc.property(
        versionArb,
        fc.option(versionArb, { nil: null }),
        nonEmptyNotesArb,
        (currentVersion, lastSeenVersion, releaseNotes) => {
          expect(
            shouldOpenChangelogModal({
              isDev: false,
              updateAvailable: true,
              updateCheckCompleted: true,
              currentVersion,
              lastSeenVersion,
              releaseNotes,
            })
          ).toBe(false)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("SHALL not open when notes are empty/whitespace", () => {
    fc.assert(
      fc.property(
        versionArb,
        fc.option(versionArb, { nil: null }),
        whitespaceNotesArb,
        (currentVersion, lastSeenVersion, releaseNotes) => {
          expect(
            shouldOpenChangelogModal({
              isDev: false,
              updateAvailable: false,
              updateCheckCompleted: true,
              currentVersion,
              lastSeenVersion,
              releaseNotes,
            })
          ).toBe(false)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("SHALL not open when current version was already seen", () => {
    fc.assert(
      fc.property(versionArb, nonEmptyNotesArb, (currentVersion, releaseNotes) => {
        expect(
          shouldOpenChangelogModal({
            isDev: false,
            updateAvailable: false,
            updateCheckCompleted: true,
            currentVersion,
            lastSeenVersion: currentVersion,
            releaseNotes,
          })
        ).toBe(false)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it("SHALL open when update check is complete, no update is available, notes are non-empty, and version is new", () => {
    fc.assert(
      fc.property(
        versionArb,
        versionArb.filter((v) => v !== "0.0.0"),
        nonEmptyNotesArb,
        (currentVersion, otherVersion, releaseNotes) => {
          // Ensure lastSeenVersion differs from currentVersion
          const lastSeenVersion = otherVersion === currentVersion ? "0.0.0" : otherVersion

          expect(
            shouldOpenChangelogModal({
              isDev: false,
              updateAvailable: false,
              updateCheckCompleted: true,
              currentVersion,
              lastSeenVersion,
              releaseNotes,
            })
          ).toBe(true)

          return true
        }
      ),
      { numRuns: 200 }
    )
  })
})
