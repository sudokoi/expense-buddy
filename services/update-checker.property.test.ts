/**
 * Property-based tests for Update Checker Service
 * Feature: in-app-update
 *
 * These tests verify the update checker service's dismissal persistence
 * and filtering logic for update notifications.
 */

import * as fc from "fast-check"

// Mock AsyncStorage before imports
const mockStorage = new Map<string, string>()

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value)
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStorage.delete(key)
  }),
}))

// Mock react-native Platform
jest.mock("react-native", () => ({
  Platform: {
    OS: "android",
  },
}))

import {
  getDismissedVersion,
  setDismissedVersion,
  clearDismissedVersion,
  shouldShowUpdateNotification,
  UpdateInfo,
} from "./update-checker"

describe("Update Checker Properties", () => {
  beforeEach(() => {
    mockStorage.clear()
    jest.clearAllMocks()
  })

  /**
   * Property 4: Dismissal Persistence Round-Trip
   * For any version string, storing it as dismissed and then retrieving it
   * SHALL return the same version string.
   */
  describe("Property 4: Dismissal Persistence Round-Trip", () => {
    // Arbitrary for generating valid semantic version strings
    const versionArb = fc
      .tuple(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 })
      )
      .map(([major, minor, patch]) => `${major}.${minor}.${patch}`)

    it("storing and retrieving a version SHALL return the same version", async () => {
      await fc.assert(
        fc.asyncProperty(versionArb, async (version) => {
          // Clear any previous state
          mockStorage.clear()

          // Store the version
          await setDismissedVersion(version)

          // Retrieve the version
          const retrieved = await getDismissedVersion()

          // Should be the same
          expect(retrieved).toBe(version)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("clearing dismissed version SHALL result in null on retrieval", async () => {
      await fc.assert(
        fc.asyncProperty(versionArb, async (version) => {
          // Clear any previous state
          mockStorage.clear()

          // Store a version
          await setDismissedVersion(version)

          // Clear it
          await clearDismissedVersion()

          // Should be null
          const retrieved = await getDismissedVersion()
          expect(retrieved).toBeNull()

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("getDismissedVersion SHALL return null when no version has been stored", async () => {
      // Clear any previous state
      mockStorage.clear()

      const retrieved = await getDismissedVersion()
      expect(retrieved).toBeNull()
    })

    it("setDismissedVersion SHALL overwrite previously stored version", async () => {
      await fc.assert(
        fc.asyncProperty(versionArb, versionArb, async (version1, version2) => {
          // Clear any previous state
          mockStorage.clear()

          // Store first version
          await setDismissedVersion(version1)

          // Store second version (overwrite)
          await setDismissedVersion(version2)

          // Should return the second version
          const retrieved = await getDismissedVersion()
          expect(retrieved).toBe(version2)

          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 2: Dismissal Filtering
   * For any available update version and dismissed version, the notification
   * SHALL be shown if and only if the available version is different from the dismissed version.
   */
  describe("Property 2: Dismissal Filtering", () => {
    // Arbitrary for generating valid semantic version strings
    const versionArb = fc
      .tuple(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 })
      )
      .map(([major, minor, patch]) => `${major}.${minor}.${patch}`)

    // Arbitrary for generating UpdateInfo with an available update
    const updateInfoWithUpdateArb = versionArb.map(
      (version): UpdateInfo => ({
        hasUpdate: true,
        currentVersion: "1.0.0",
        latestVersion: version,
        releaseUrl: "https://github.com/test/repo/releases",
      })
    )

    // Arbitrary for generating UpdateInfo without an update
    const updateInfoNoUpdateArb = fc.constant<UpdateInfo>({
      hasUpdate: false,
      currentVersion: "1.0.0",
    })

    it("notification SHALL be shown when update available and no dismissed version", () => {
      fc.assert(
        fc.property(updateInfoWithUpdateArb, (updateInfo) => {
          const result = shouldShowUpdateNotification(updateInfo, null)
          expect(result).toBe(true)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it("notification SHALL NOT be shown when no update available", () => {
      fc.assert(
        fc.property(
          updateInfoNoUpdateArb,
          fc.option(versionArb, { nil: null }),
          (updateInfo, dismissedVersion) => {
            const result = shouldShowUpdateNotification(updateInfo, dismissedVersion)
            expect(result).toBe(false)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("notification SHALL NOT be shown when available version equals dismissed version", () => {
      fc.assert(
        fc.property(versionArb, (version) => {
          const updateInfo: UpdateInfo = {
            hasUpdate: true,
            currentVersion: "1.0.0",
            latestVersion: version,
            releaseUrl: "https://github.com/test/repo/releases",
          }
          const result = shouldShowUpdateNotification(updateInfo, version)
          expect(result).toBe(false)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it("notification SHALL be shown when available version differs from dismissed version", () => {
      fc.assert(
        fc.property(
          versionArb,
          versionArb.filter((v) => v !== "1.0.0"), // Ensure different versions
          (availableVersion, dismissedVersion) => {
            // Skip if versions happen to be the same
            if (availableVersion === dismissedVersion) {
              return true
            }

            const updateInfo: UpdateInfo = {
              hasUpdate: true,
              currentVersion: "0.9.0",
              latestVersion: availableVersion,
              releaseUrl: "https://github.com/test/repo/releases",
            }
            const result = shouldShowUpdateNotification(updateInfo, dismissedVersion)
            expect(result).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("notification SHALL NOT be shown when latestVersion is missing", () => {
      const updateInfoNoLatestVersion: UpdateInfo = {
        hasUpdate: true,
        currentVersion: "1.0.0",
        // latestVersion is undefined
      }
      const result = shouldShowUpdateNotification(updateInfoNoLatestVersion, null)
      expect(result).toBe(false)
    })
  })
})
