import AsyncStorage from "@react-native-async-storage/async-storage"
import { useCallback, useEffect, useRef, useState } from "react"
import { APP_CONFIG } from "../constants/app-config"
import { requestPlayStoreReview } from "../services/play-store-review"
import { isPlayStoreInstall } from "../services/update-checker"

const REVIEW_STATE_KEY = "@expense-buddy/play-store-review-state"

const MIN_DAYS_SINCE_FIRST_USE = 7
const MIN_SESSIONS_BEFORE_PROMPT = 4
const MIN_DAYS_BETWEEN_REVIEW_ATTEMPTS = 30

interface PlayStoreReviewState {
  firstSeenAt: number
  lastAttemptAt?: number
  lastAttemptedVersion?: string
  sessionCount: number
}

interface ReviewEligibilityInput {
  currentVersion: string
  isDev: boolean
  isPlayStoreInstall: boolean
  now: number
  state: PlayStoreReviewState
  updateAvailable: boolean
  updateCheckCompleted: boolean
}

export type PlayStoreReviewEligibilityReason =
  | "eligible"
  | "dev_build"
  | "not_play_store_install"
  | "update_check_pending"
  | "update_available"
  | "already_attempted_for_version"
  | "not_enough_sessions"
  | "too_soon_since_first_use"
  | "cooldown_active"

export interface UsePlayStoreReviewOptions {
  updateAvailable: boolean
  updateCheckCompleted: boolean
}

export interface UsePlayStoreReviewResult {
  markReviewEligibleForCurrentVersion: () => Promise<void>
}

function createDefaultReviewState(now: number): PlayStoreReviewState {
  return {
    firstSeenAt: now,
    sessionCount: 0,
  }
}

async function loadPlayStoreReviewState(now: number): Promise<PlayStoreReviewState> {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_STATE_KEY)
    if (!raw) {
      return createDefaultReviewState(now)
    }

    const parsed = JSON.parse(raw) as Partial<PlayStoreReviewState>
    return {
      firstSeenAt: typeof parsed.firstSeenAt === "number" ? parsed.firstSeenAt : now,
      lastAttemptAt:
        typeof parsed.lastAttemptAt === "number" ? parsed.lastAttemptAt : undefined,
      lastAttemptedVersion:
        typeof parsed.lastAttemptedVersion === "string"
          ? parsed.lastAttemptedVersion
          : undefined,
      sessionCount:
        typeof parsed.sessionCount === "number" && parsed.sessionCount >= 0
          ? parsed.sessionCount
          : 0,
    }
  } catch {
    return createDefaultReviewState(now)
  }
}

async function persistPlayStoreReviewState(state: PlayStoreReviewState): Promise<void> {
  await AsyncStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(state))
}

export function advancePlayStoreReviewSession(
  state: PlayStoreReviewState,
  now: number
): PlayStoreReviewState {
  return {
    ...state,
    firstSeenAt: state.firstSeenAt || now,
    sessionCount: state.sessionCount + 1,
  }
}

export function recordPlayStoreReviewAttempt(
  state: PlayStoreReviewState,
  version: string,
  now: number
): PlayStoreReviewState {
  return {
    ...state,
    lastAttemptAt: now,
    lastAttemptedVersion: version,
  }
}

export function shouldAttemptPlayStoreReview({
  currentVersion,
  isDev,
  isPlayStoreInstall,
  now,
  state,
  updateAvailable,
  updateCheckCompleted,
}: ReviewEligibilityInput): boolean {
  return (
    getPlayStoreReviewEligibilityReason({
      currentVersion,
      isDev,
      isPlayStoreInstall,
      now,
      state,
      updateAvailable,
      updateCheckCompleted,
    }) === "eligible"
  )
}

export function getPlayStoreReviewEligibilityReason({
  currentVersion,
  isDev,
  isPlayStoreInstall,
  now,
  state,
  updateAvailable,
  updateCheckCompleted,
}: ReviewEligibilityInput): PlayStoreReviewEligibilityReason {
  if (isDev || !isPlayStoreInstall) {
    return isDev ? "dev_build" : "not_play_store_install"
  }

  if (!updateCheckCompleted) {
    return "update_check_pending"
  }

  if (updateAvailable) {
    return "update_available"
  }

  if (state.lastAttemptedVersion === currentVersion) {
    return "already_attempted_for_version"
  }

  if (state.sessionCount < MIN_SESSIONS_BEFORE_PROMPT) {
    return "not_enough_sessions"
  }

  if (now - state.firstSeenAt < MIN_DAYS_SINCE_FIRST_USE * 24 * 60 * 60 * 1000) {
    return "too_soon_since_first_use"
  }

  if (
    state.lastAttemptAt &&
    now - state.lastAttemptAt < MIN_DAYS_BETWEEN_REVIEW_ATTEMPTS * 24 * 60 * 60 * 1000
  ) {
    return "cooldown_active"
  }

  return "eligible"
}

export function usePlayStoreReview({
  updateAvailable,
  updateCheckCompleted,
}: UsePlayStoreReviewOptions): UsePlayStoreReviewResult {
  const [reviewState, setReviewState] = useState<PlayStoreReviewState | null>(null)
  const [playStoreInstall, setPlayStoreInstall] = useState<boolean | null>(null)
  const hasAttemptedThisSession = useRef(false)

  useEffect(() => {
    let isMounted = true

    const initialize = async () => {
      const now = Date.now()
      const state = advancePlayStoreReviewSession(
        await loadPlayStoreReviewState(now),
        now
      )
      await persistPlayStoreReviewState(state)

      const fromPlayStore = await isPlayStoreInstall()

      if (!isMounted) {
        return
      }

      setReviewState(state)
      setPlayStoreInstall(fromPlayStore)
    }

    initialize()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!reviewState || hasAttemptedThisSession.current) {
      return
    }

    const now = Date.now()
    const eligibilityReason = getPlayStoreReviewEligibilityReason({
      currentVersion: APP_CONFIG.version,
      isDev: __DEV__,
      isPlayStoreInstall: playStoreInstall === true,
      now,
      state: reviewState,
      updateAvailable,
      updateCheckCompleted,
    })

    if (eligibilityReason !== "eligible") {
      console.info("Play Store review skipped:", eligibilityReason)
      return
    }

    if (
      !shouldAttemptPlayStoreReview({
        currentVersion: APP_CONFIG.version,
        isDev: __DEV__,
        isPlayStoreInstall: playStoreInstall === true,
        now,
        state: reviewState,
        updateAvailable,
        updateCheckCompleted,
      })
    ) {
      return
    }

    hasAttemptedThisSession.current = true

    const run = async () => {
      try {
        await requestPlayStoreReview()
        const nextState = recordPlayStoreReviewAttempt(
          reviewState,
          APP_CONFIG.version,
          now
        )
        await persistPlayStoreReviewState(nextState)
        setReviewState(nextState)
      } catch {
        // Play review flows may no-op or fail transiently; do not change app flow.
        console.warn("Play Store review request failed")
      }
    }

    run()
  }, [playStoreInstall, reviewState, updateAvailable, updateCheckCompleted])

  const markReviewEligibleForCurrentVersion = useCallback(async () => {
    // Eligibility is now derived from usage history and Play availability.
    // Keep the method as a no-op so existing call sites remain harmless.
  }, [])

  return {
    markReviewEligibleForCurrentVersion,
  }
}
