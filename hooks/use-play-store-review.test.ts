jest.mock("../modules/expense-buddy-play-core", () => ({
  __esModule: true,
  default: null,
}))

import {
  advancePlayStoreReviewSession,
  getPlayStoreReviewEligibilityReason,
  recordPlayStoreReviewAttempt,
  shouldAttemptPlayStoreReview,
} from "./use-play-store-review"

describe("usePlayStoreReview gating", () => {
  const now = new Date("2026-04-21T12:00:00Z").getTime()
  const dayMs = 24 * 60 * 60 * 1000

  it("does not attempt a review when the device is not a Play Store install", () => {
    expect(
      shouldAttemptPlayStoreReview({
        currentVersion: "3.2.0",
        isDev: false,
        isPlayStoreInstall: false,
        now,
        state: {
          firstSeenAt: now - 40 * dayMs,
          sessionCount: 20,
        },
        updateAvailable: false,
        updateCheckCompleted: true,
      })
    ).toBe(false)
  })

  it("does not attempt a review before the update check completes", () => {
    expect(
      shouldAttemptPlayStoreReview({
        currentVersion: "3.2.0",
        isDev: false,
        isPlayStoreInstall: true,
        now,
        state: {
          firstSeenAt: now - 40 * dayMs,
          sessionCount: 20,
        },
        updateAvailable: false,
        updateCheckCompleted: false,
      })
    ).toBe(false)
  })

  it("does not attempt a review before the minimum usage thresholds", () => {
    expect(
      shouldAttemptPlayStoreReview({
        currentVersion: "3.2.0",
        isDev: false,
        isPlayStoreInstall: true,
        now,
        state: {
          firstSeenAt: now - 3 * dayMs,
          sessionCount: 2,
        },
        updateAvailable: false,
        updateCheckCompleted: true,
      })
    ).toBe(false)
  })

  it("does not attempt a review again during the long cooldown window", () => {
    expect(
      shouldAttemptPlayStoreReview({
        currentVersion: "3.3.0",
        isDev: false,
        isPlayStoreInstall: true,
        now,
        state: {
          firstSeenAt: now - 300 * dayMs,
          lastAttemptAt: now - 29 * dayMs,
          sessionCount: 40,
        },
        updateAvailable: false,
        updateCheckCompleted: true,
      })
    ).toBe(false)
  })

  it("attempts a review once usage thresholds are met and no update is pending", () => {
    expect(
      shouldAttemptPlayStoreReview({
        currentVersion: "3.2.0",
        isDev: false,
        isPlayStoreInstall: true,
        now,
        state: {
          firstSeenAt: now - 200 * dayMs,
          lastAttemptAt: now - 180 * dayMs,
          sessionCount: 25,
        },
        updateAvailable: false,
        updateCheckCompleted: true,
      })
    ).toBe(true)
  })

  it("records the session after an attempt", () => {
    const initialState = {
      firstSeenAt: now - 200 * dayMs,
      sessionCount: 24,
    }

    const nextSession = advancePlayStoreReviewSession(initialState, now)
    const attemptedState = recordPlayStoreReviewAttempt(nextSession, "3.2.0", now)

    expect(nextSession.sessionCount).toBe(25)
    expect(attemptedState.lastAttemptedVersion).toBe("3.2.0")
  })

  it("exposes the specific ineligibility reason", () => {
    expect(
      getPlayStoreReviewEligibilityReason({
        currentVersion: "3.2.0",
        isDev: false,
        isPlayStoreInstall: true,
        now,
        state: {
          firstSeenAt: now - 2 * dayMs,
          sessionCount: 2,
        },
        updateAvailable: false,
        updateCheckCompleted: true,
      })
    ).toBe("not_enough_sessions")
  })

  it("blocks review while an update is available", () => {
    expect(
      getPlayStoreReviewEligibilityReason({
        currentVersion: "3.2.0",
        isDev: false,
        isPlayStoreInstall: true,
        now,
        state: {
          firstSeenAt: now - 40 * dayMs,
          sessionCount: 20,
        },
        updateAvailable: true,
        updateCheckCompleted: true,
      })
    ).toBe("update_available")
  })
})
