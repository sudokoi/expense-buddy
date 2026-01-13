import { setup, assign, fromPromise } from "xstate"
import { Platform } from "react-native"
import * as WebBrowser from "expo-web-browser"

import { secureStorage } from "./secure-storage"
import { getGitHubOAuthClientIdStatus } from "../constants/runtime-config"
import {
  requestGitHubDeviceCode,
  pollGitHubDeviceAccessTokenOnce,
  GitHubDeviceCode,
} from "./github-device-flow"

const TOKEN_KEY = "github_pat"

export type GitHubAuthMachineState =
  | "initializing"
  | "signedOut"
  | "requestingDeviceCode"
  | "polling"
  | "waitingToPoll"
  | "persistingToken"
  | "authenticated"
  | "signingOut"
  | "error"

export interface GitHubAuthContext {
  token: string
  deviceCode: GitHubDeviceCode | null
  pollIntervalMs: number
  expiresAtMs: number | null

  justSignedIn: boolean
  error: string | null
}

export type GitHubAuthEvent =
  | { type: "REFRESH" }
  | { type: "SIGN_IN" }
  | { type: "CANCEL" }
  | { type: "SIGN_OUT" }
  | { type: "ACK_JUST_SIGNED_IN" }
  | { type: "ACK_ERROR" }

function safeNow(): number {
  return Date.now()
}

function safeMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

async function loadStoredToken(): Promise<string | null> {
  try {
    const token = await secureStorage.getItem(TOKEN_KEY)
    return token && token.trim().length > 0 ? token : null
  } catch {
    return null
  }
}

async function deleteStoredToken(): Promise<void> {
  try {
    await secureStorage.deleteItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

async function persistToken(token: string): Promise<void> {
  await secureStorage.setItem(TOKEN_KEY, token)
}

async function requestDeviceCode(): Promise<GitHubDeviceCode> {
  const status = getGitHubOAuthClientIdStatus()
  if (!status.ok) {
    throw new Error(status.error)
  }

  return await requestGitHubDeviceCode({
    clientId: status.clientId,
    scope: "repo",
  })
}

async function pollOnce(
  deviceCode: GitHubDeviceCode
): Promise<Awaited<ReturnType<typeof pollGitHubDeviceAccessTokenOnce>>> {
  const status = getGitHubOAuthClientIdStatus()
  if (!status.ok) {
    throw new Error(status.error)
  }

  return await pollGitHubDeviceAccessTokenOnce({
    clientId: status.clientId,
    deviceCode: deviceCode.device_code,
  })
}

export const githubAuthMachine = setup({
  types: {
    context: {} as GitHubAuthContext,
    events: {} as GitHubAuthEvent,
  },
  actors: {
    loadStoredToken: fromPromise(loadStoredToken),
    requestDeviceCode: fromPromise(requestDeviceCode),
    pollOnce: fromPromise(({ input }: { input: { deviceCode: GitHubDeviceCode } }) =>
      pollOnce(input.deviceCode)
    ),
    persistToken: fromPromise(({ input }: { input: { token: string } }) =>
      persistToken(input.token)
    ),
    deleteStoredToken: fromPromise(deleteStoredToken),
  },
  delays: {
    POLL_DELAY: ({ context }) => context.pollIntervalMs,
  },
}).createMachine({
  id: "githubAuth",
  initial: "initializing",
  context: {
    token: "",
    deviceCode: null,
    pollIntervalMs: 5000,
    expiresAtMs: null,
    justSignedIn: false,
    error: null,
  },
  on: {
    REFRESH: {
      target: "initializing",
      actions: assign({
        deviceCode: () => null,
        expiresAtMs: () => null,
        justSignedIn: () => false,
        error: () => null,
      }),
    },
  },
  states: {
    initializing: {
      invoke: {
        src: "loadStoredToken",
        onDone: [
          {
            guard: ({ event }) => Boolean(event.output),
            target: "authenticated",
            actions: assign({
              token: ({ event }) => String(event.output || ""),
              justSignedIn: () => false,
              error: () => null,
            }),
          },
          {
            target: "signedOut",
            actions: assign({
              token: () => "",
              justSignedIn: () => false,
              error: () => null,
            }),
          },
        ],
        onError: {
          target: "signedOut",
          actions: assign({ token: () => "" }),
        },
      },
    },

    signedOut: {
      on: {
        SIGN_IN: {
          target: "requestingDeviceCode",
          actions: assign({
            error: () => null,
            deviceCode: () => null,
            expiresAtMs: () => null,
            justSignedIn: () => false,
            pollIntervalMs: () => 5000,
          }),
        },
      },
    },

    requestingDeviceCode: {
      invoke: {
        src: "requestDeviceCode",
        onDone: {
          target: "polling",
          actions: [
            assign({
              deviceCode: ({ event }) => event.output,
              expiresAtMs: ({ event }) => safeNow() + event.output.expires_in * 1000,
              pollIntervalMs: ({ event }) => (event.output.interval || 5) * 1000,
              error: () => null,
            }),
            ({ event }) => {
              // Open browser on native; on web this is a no-op.
              try {
                const code = event.output
                const url = code.verification_uri_complete || code.verification_uri
                if (Platform.OS !== "web") {
                  void WebBrowser.openBrowserAsync(url)
                }
              } catch {
                // ignore
              }
            },
          ],
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) => safeMessage(event.error),
          }),
        },
      },
      on: {
        CANCEL: { target: "signedOut" },
        SIGN_OUT: { target: "signingOut" },
      },
    },

    polling: {
      always: [
        {
          guard: ({ context }) =>
            Boolean(context.expiresAtMs) && safeNow() > (context.expiresAtMs || 0),
          target: "error",
          actions: assign({
            error: () => "GitHub sign-in expired. Please try again.",
            deviceCode: () => null,
            expiresAtMs: () => null,
          }),
        },
      ],
      invoke: {
        src: "pollOnce",
        input: ({ context }) => ({
          deviceCode: context.deviceCode as GitHubDeviceCode,
        }),
        onDone: [
          {
            guard: ({ event }) => event.output.type === "success",
            target: "persistingToken",
            actions: assign({
              token: ({ event }) =>
                event.output.type === "success" ? event.output.token.access_token : "",
              justSignedIn: () => true,
              error: () => null,
            }),
          },
          {
            guard: ({ event }) => event.output.type === "expired",
            target: "error",
            actions: assign({
              error: () => "GitHub sign-in expired. Please try again.",
              deviceCode: () => null,
              expiresAtMs: () => null,
            }),
          },
          {
            guard: ({ event }) => event.output.type === "denied",
            target: "error",
            actions: assign({
              error: () => "GitHub sign-in was denied.",
              deviceCode: () => null,
              expiresAtMs: () => null,
            }),
          },
          {
            guard: ({ event }) => event.output.type === "error",
            target: "error",
            actions: assign({
              error: ({ event }) =>
                event.output.type === "error" ? event.output.message : "Sign-in failed.",
              deviceCode: () => null,
              expiresAtMs: () => null,
            }),
          },
          {
            guard: ({ event }) => event.output.type === "slow_down",
            target: "waitingToPoll",
            actions: assign({
              pollIntervalMs: ({ context }) => context.pollIntervalMs + 5000,
            }),
          },
          // authorization_pending
          {
            target: "waitingToPoll",
          },
        ],
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) => safeMessage(event.error),
            deviceCode: () => null,
            expiresAtMs: () => null,
          }),
        },
      },
      on: {
        CANCEL: { target: "signedOut" },
        SIGN_OUT: { target: "signingOut" },
      },
    },

    waitingToPoll: {
      after: {
        POLL_DELAY: { target: "polling" },
      },
      on: {
        CANCEL: { target: "signedOut" },
        SIGN_OUT: { target: "signingOut" },
      },
    },

    persistingToken: {
      invoke: {
        src: "persistToken",
        input: ({ context }) => ({ token: context.token }),
        onDone: {
          target: "authenticated",
          actions: assign({
            deviceCode: () => null,
            expiresAtMs: () => null,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) => safeMessage(event.error),
          }),
        },
      },
      on: {
        SIGN_OUT: { target: "signingOut" },
      },
    },

    authenticated: {
      on: {
        SIGN_OUT: { target: "signingOut" },
        ACK_JUST_SIGNED_IN: {
          actions: assign({ justSignedIn: () => false }),
        },
      },
    },

    signingOut: {
      invoke: {
        src: "deleteStoredToken",
        onDone: {
          target: "signedOut",
          actions: assign({
            token: () => "",
            deviceCode: () => null,
            expiresAtMs: () => null,
            justSignedIn: () => false,
            error: () => null,
          }),
        },
        onError: {
          target: "signedOut",
          actions: assign({
            token: () => "",
            deviceCode: () => null,
            expiresAtMs: () => null,
            justSignedIn: () => false,
          }),
        },
      },
    },

    error: {
      on: {
        SIGN_IN: {
          target: "requestingDeviceCode",
          actions: assign({
            error: () => null,
            deviceCode: () => null,
            expiresAtMs: () => null,
            justSignedIn: () => false,
            pollIntervalMs: () => 5000,
          }),
        },
        SIGN_OUT: { target: "signingOut" },
        ACK_ERROR: {
          actions: assign({ error: () => null }),
        },
      },
    },
  },
})
