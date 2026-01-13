import { useSelector } from "@xstate/react"
import { useCallback, useMemo } from "react"

import { GitHubAuthMachineState } from "../services/github-auth-machine"
import { useStoreContext } from "../stores/store-provider"

export interface UseGitHubAuthMachineReturn {
  state: GitHubAuthMachineState

  isSignedOut: boolean
  isSigningIn: boolean
  isAuthenticated: boolean
  isError: boolean

  token: string
  deviceCode: import("../services/github-device-flow").GitHubDeviceCode | null
  justSignedIn: boolean
  error: string | null

  signIn: () => void
  cancel: () => void
  signOut: () => void
  refresh: () => void
  ackJustSignedIn: () => void
  ackError: () => void
}

export function useGitHubAuthMachine(): UseGitHubAuthMachineReturn {
  const { githubAuthActor } = useStoreContext()

  const snapshot = useSelector(githubAuthActor, (s) => s)
  const state = snapshot.value as GitHubAuthMachineState

  const isSignedOut = state === "signedOut"
  const isSigningIn =
    state === "requestingDeviceCode" ||
    state === "polling" ||
    state === "waitingToPoll" ||
    state === "persistingToken"
  const isAuthenticated = state === "authenticated"
  const isError = state === "error"

  const signIn = useCallback(() => {
    githubAuthActor.send({ type: "SIGN_IN" })
  }, [githubAuthActor])

  const cancel = useCallback(() => {
    githubAuthActor.send({ type: "CANCEL" })
  }, [githubAuthActor])

  const signOut = useCallback(() => {
    githubAuthActor.send({ type: "SIGN_OUT" })
  }, [githubAuthActor])

  const refresh = useCallback(() => {
    githubAuthActor.send({ type: "REFRESH" })
  }, [githubAuthActor])

  const ackJustSignedIn = useCallback(() => {
    githubAuthActor.send({ type: "ACK_JUST_SIGNED_IN" })
  }, [githubAuthActor])

  const ackError = useCallback(() => {
    githubAuthActor.send({ type: "ACK_ERROR" })
  }, [githubAuthActor])

  const contextData = useMemo(
    () => ({
      token: String(snapshot.context.token || ""),
      deviceCode: snapshot.context.deviceCode ?? null,
      justSignedIn: Boolean(snapshot.context.justSignedIn),
      error: snapshot.context.error ?? null,
    }),
    [snapshot.context]
  )

  return {
    state,
    isSignedOut,
    isSigningIn,
    isAuthenticated,
    isError,
    ...contextData,
    signIn,
    cancel,
    signOut,
    refresh,
    ackJustSignedIn,
    ackError,
  }
}
