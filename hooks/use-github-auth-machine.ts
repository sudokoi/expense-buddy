import { useSelector } from "@xstate/react"
import { useCallback, useMemo } from "react"

import {
  GitHubAuthMachineState,
  GitHubAuthCallbacks,
} from "../services/github-auth-machine"
import { useStoreContext } from "../stores/store-provider"

export interface UseGitHubAuthMachineReturn {
  state: GitHubAuthMachineState

  isSignedOut: boolean
  isSigningIn: boolean
  isAuthenticated: boolean
  isError: boolean

  token: string
  deviceCode: import("../services/github-device-flow").GitHubDeviceCode | null
  error: string | null

  signIn: (callbacks?: GitHubAuthCallbacks) => void
  cancel: () => void
  signOut: () => void
  refresh: () => void
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

  const signIn = useCallback(
    (callbacks?: GitHubAuthCallbacks) => {
      githubAuthActor.send({ type: "SIGN_IN", callbacks })
    },
    [githubAuthActor]
  )

  const cancel = useCallback(() => {
    githubAuthActor.send({ type: "CANCEL" })
  }, [githubAuthActor])

  const signOut = useCallback(() => {
    githubAuthActor.send({ type: "SIGN_OUT" })
  }, [githubAuthActor])

  const refresh = useCallback(() => {
    githubAuthActor.send({ type: "REFRESH" })
  }, [githubAuthActor])

  const contextData = useMemo(
    () => ({
      token: String(snapshot.context.token || ""),
      deviceCode: snapshot.context.deviceCode ?? null,
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
  }
}
