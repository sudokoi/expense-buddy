jest.mock("../modules/expense-buddy-play-core", () => ({
  __esModule: true,
  default: null,
}))

import {
  advancePlayStoreReviewSession,
  markPlayStoreReviewPending,
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
        sessionStartedAt: now,
        state: {
          firstSeenAt: now - 40 * dayMs,
          pendingMarkedAt: now - dayMs,
          pendingVersion: "3.2.0",
          sessionCount: 20,
        },
        updateAvailable: false,
        updateCheckCompleted: true,
      })
    ).toBe(false)
  })

  it("does not attempt a review in the same session that the version became eligible", () => {
    expect(
      shouldAttemptPlayStoreReview({
        currentVersion: "3.2.0",
        isDev: false,
        isPlayStoreInstall: true,
        now,
        sessionStartedAt: now - 5 * 60 * 1000,
        state: {
          firstSeenAt: now - 40 * dayMs,
          pendingMarkedAt: now - 60 * 1000,
          pendingVersion: "3.2.0",
          sessionCount: 20,
        },
        updateAvailable: false,
        updateCheckCompleted: true,
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
        sessionStartedAt: now,
        state: {
          firstSeenAt: now - 3 * dayMs,
          pendingMarkedAt: now - 2 * dayMs,
          pendingVersion: "3.2.0",
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
        sessionStartedAt: now,
        state: {
          firstSeenAt: now - 300 * dayMs,
          lastAttemptAt: now - 30 * dayMs,
          pendingMarkedAt: now - 2 * dayMs,
          pendingVersion: "3.3.0",
          sessionCount: 40,
        },
        updateAvailable: false,
        updateCheckCompleted: true,
      })
    ).toBe(false)
  })

  it("attempts a review only after a previous session marks the current version eligible", () => {
    expect(
      shouldAttemptPlayStoreReview({
        currentVersion: "3.2.0",
        isDev: false,
        isPlayStoreInstall: true,
        now,
        sessionStartedAt: now - 2 * 60 * 60 * 1000,
        state: {
          firstSeenAt: now - 200 * dayMs,
          lastAttemptAt: now - 180 * dayMs,
          pendingMarkedAt: now - 7 * dayMs,
          pendingVersion: "3.2.0",
          sessionCount: 25,
        },
        updateAvailable: false,
        updateCheckCompleted: true,
      })
    ).toBe(true)
  })

  it("records the session and clears pending review state after an attempt", () => {
    const initialState = {
      firstSeenAt: now - 200 * dayMs,
      pendingMarkedAt: now - 7 * dayMs,
      pendingVersion: "3.2.0",
      sessionCount: 24,
    }

    const nextSession = advancePlayStoreReviewSession(initialState, now)
    const pendingState = markPlayStoreReviewPending(nextSession, "3.2.0", now)
    const attemptedState = recordPlayStoreReviewAttempt(pendingState, "3.2.0", now)

    expect(nextSession.sessionCount).toBe(25)
    expect(pendingState.pendingVersion).toBe("3.2.0")
    expect(attemptedState.lastAttemptedVersion).toBe("3.2.0")
    expect(attemptedState.pendingVersion).toBeUndefined()
  })
})
