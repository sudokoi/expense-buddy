import AsyncStorage from "@react-native-async-storage/async-storage"
import { useCallback, useEffect, useRef, useState } from "react"
import { APP_CONFIG } from "../constants/app-config"
import { requestPlayStoreReview } from "../services/play-store-review"
import { isPlayStoreInstall } from "../services/update-checker"

const REVIEW_STATE_KEY = "@expense-buddy/play-store-review-state"

const MIN_DAYS_SINCE_FIRST_USE = 14
const MIN_SESSIONS_BEFORE_PROMPT = 8
const MIN_DAYS_BETWEEN_REVIEW_ATTEMPTS = 120

interface PlayStoreReviewState {
  firstSeenAt: number
  lastAttemptAt?: number
  lastAttemptedVersion?: string
  pendingMarkedAt?: number
  pendingVersion?: string
  sessionCount: number
}

interface ReviewEligibilityInput {
  currentVersion: string
  isDev: boolean
  isPlayStoreInstall: boolean
  now: number
  sessionStartedAt: number
  state: PlayStoreReviewState
  updateAvailable: boolean
  updateCheckCompleted: boolean
}

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
      pendingMarkedAt:
        typeof parsed.pendingMarkedAt === "number" ? parsed.pendingMarkedAt : undefined,
      pendingVersion:
        typeof parsed.pendingVersion === "string" ? parsed.pendingVersion : undefined,
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

export function markPlayStoreReviewPending(
  state: PlayStoreReviewState,
  version: string,
  now: number
): PlayStoreReviewState {
  return {
    ...state,
    pendingMarkedAt: now,
    pendingVersion: version,
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
    pendingMarkedAt: undefined,
    pendingVersion: undefined,
  }
}

export function shouldAttemptPlayStoreReview({
  currentVersion,
  isDev,
  isPlayStoreInstall,
  now,
  sessionStartedAt,
  state,
  updateAvailable,
  updateCheckCompleted,
}: ReviewEligibilityInput): boolean {
  if (isDev || !isPlayStoreInstall) {
    return false
  }

  if (!updateCheckCompleted || updateAvailable) {
    return false
  }

  if (!state.pendingVersion || state.pendingVersion !== currentVersion) {
    return false
  }

  if (!state.pendingMarkedAt || state.pendingMarkedAt >= sessionStartedAt) {
    return false
  }

  if (state.lastAttemptedVersion === currentVersion) {
    return false
  }

  if (state.sessionCount < MIN_SESSIONS_BEFORE_PROMPT) {
    return false
  }

  if (now - state.firstSeenAt < MIN_DAYS_SINCE_FIRST_USE * 24 * 60 * 60 * 1000) {
    return false
  }

  if (
    state.lastAttemptAt &&
    now - state.lastAttemptAt < MIN_DAYS_BETWEEN_REVIEW_ATTEMPTS * 24 * 60 * 60 * 1000
  ) {
    return false
  }

  return true
}

export function usePlayStoreReview({
  updateAvailable,
  updateCheckCompleted,
}: UsePlayStoreReviewOptions): UsePlayStoreReviewResult {
  const [reviewState, setReviewState] = useState<PlayStoreReviewState | null>(null)
  const [playStoreInstall, setPlayStoreInstall] = useState<boolean | null>(null)
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)
  const hasAttemptedThisSession = useRef(false)

  useEffect(() => {
    let isMounted = true

    const initialize = async () => {
      const now = Date.now()
      const state = advancePlayStoreReviewSession(await loadPlayStoreReviewState(now), now)
      await persistPlayStoreReviewState(state)

      const fromPlayStore = await isPlayStoreInstall()

      if (!isMounted) {
        return
      }

      setReviewState(state)
      setPlayStoreInstall(fromPlayStore)
      setSessionStartedAt(now)
    }

    initialize()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!reviewState || !sessionStartedAt || hasAttemptedThisSession.current) {
      return
    }

    const now = Date.now()
    if (
      !shouldAttemptPlayStoreReview({
        currentVersion: APP_CONFIG.version,
        isDev: __DEV__,
        isPlayStoreInstall: playStoreInstall === true,
        now,
        sessionStartedAt,
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
      }
    }

    run()
  }, [
    playStoreInstall,
    reviewState,
    sessionStartedAt,
    updateAvailable,
    updateCheckCompleted,
  ])

  const markReviewEligibleForCurrentVersion = useCallback(async () => {
    if (__DEV__) {
      return
    }

    const fromPlayStore = playStoreInstall ?? (await isPlayStoreInstall())
    if (!fromPlayStore) {
      return
    }

    const now = Date.now()
    const currentState = reviewState ?? (await loadPlayStoreReviewState(now))
    const nextState = markPlayStoreReviewPending(currentState, APP_CONFIG.version, now)
    await persistPlayStoreReviewState(nextState)
    setReviewState(nextState)
  }, [playStoreInstall, reviewState])

  return {
    markReviewEligibleForCurrentVersion,
  }
}
