import { setup, assign, fromPromise } from "xstate"
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

/**
 * Optional callbacks for UI side-effects.
 *
 * Pattern mirrors `syncMachine`: keep the machine pure-ish and have the UI pass
 * callbacks at the moment it initiates a flow (e.g. SIGN_IN), avoiding
 * component-level useEffects for one-shot notifications.
 */
export interface GitHubAuthCallbacks {
  onSignedIn?: () => void
  onError?: (message: string) => void
}

export interface GitHubAuthContext {
  token: string
  deviceCode: GitHubDeviceCode | null
  pollIntervalMs: number
  expiresAtMs: number | null
  error: string | null

  callbacks: GitHubAuthCallbacks
}

export type GitHubAuthEvent =
  | { type: "REFRESH" }
  | { type: "SIGN_IN"; callbacks?: GitHubAuthCallbacks }
  | { type: "CANCEL" }
  | { type: "SIGN_OUT" }

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
    error: null,
    callbacks: {},
  },
  on: {
    REFRESH: {
      target: ".initializing",
      actions: assign({
        deviceCode: () => null,
        expiresAtMs: () => null,
        error: () => null,
        callbacks: () => ({}),
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
              error: () => null,
            }),
          },
          {
            target: "signedOut",
            actions: assign({
              token: () => "",
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
            pollIntervalMs: () => 5000,
            callbacks: ({ event }) => event.callbacks || {},
          }),
        },
      },
    },

    requestingDeviceCode: {
      invoke: {
        src: "requestDeviceCode",
        onDone: {
          target: "polling",
          actions: assign({
            deviceCode: ({ event }) => event.output,
            expiresAtMs: ({ event }) => safeNow() + event.output.expires_in * 1000,
            pollIntervalMs: ({ event }) => (event.output.interval || 5) * 1000,
            error: () => null,
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
          actions: [
            assign({
              deviceCode: () => null,
              expiresAtMs: () => null,
            }),
            ({ context }) => {
              context.callbacks.onSignedIn?.()
            },
            assign({ callbacks: () => ({}) }),
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
        SIGN_OUT: { target: "signingOut" },
      },
    },

    authenticated: {
      on: {
        SIGN_OUT: { target: "signingOut" },
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
            error: () => null,
            callbacks: () => ({}),
          }),
        },
        onError: {
          target: "signedOut",
          actions: assign({
            token: () => "",
            deviceCode: () => null,
            expiresAtMs: () => null,
            callbacks: () => ({}),
          }),
        },
      },
    },

    error: {
      entry: [
        ({ context }) => {
          const message = context.error || "Sign-in failed."
          context.callbacks.onError?.(message)
        },
        assign({ callbacks: () => ({}) }),
      ],
      on: {
        SIGN_IN: {
          target: "requestingDeviceCode",
          actions: assign({
            error: () => null,
            deviceCode: () => null,
            expiresAtMs: () => null,
            pollIntervalMs: () => 5000,
            callbacks: ({ event }) => event.callbacks || {},
          }),
        },
        SIGN_OUT: { target: "signingOut" },
      },
    },
  },
})
