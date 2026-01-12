import Constants from "expo-constants"

export const GITHUB_LOGIN_NOT_CONFIGURED_MESSAGE =
  "GitHub login isn’t configured for this build"

type ExpoExtra = {
  auth?: {
    githubOAuthClientId?: string | null
  }
}

function getExpoExtra(): ExpoExtra {
  const extra = (Constants.expoConfig?.extra ?? {}) as unknown
  return extra as ExpoExtra
}

function normalizeEnvValue(value: unknown): string | null {
  if (value == null) return null

  // Avoid treating objects as valid IDs (e.g. "[object Object]")
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase() === "undefined") return null
  if (trimmed.toLowerCase() === "null") return null
  return trimmed
}

function isProbablyGitHubOAuthClientId(value: string): boolean {
  // GitHub OAuth client IDs are opaque but typically alphanumeric.
  // Keep this intentionally permissive while rejecting obvious bad values.
  if (value.length < 8 || value.length > 128) return false
  if (value.toLowerCase().includes("object")) return false
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false
  return true
}

function getGitHubOAuthClientIdFromProcessEnv(): string | null {
  // In Expo Go / dev, EXPO_PUBLIC_* is the most reliable way to provide env at runtime.
  // EAS build profiles should still use app.config.js -> expo.extra.
  return normalizeEnvValue(
    (process.env as Record<string, unknown> | undefined)
      ?.EXPO_PUBLIC_GITHUB_OAUTH_CLIENT_ID
  )
}

export function getGitHubOAuthClientId(): string | null {
  const extra = getExpoExtra()
  const fromExtra = normalizeEnvValue(extra.auth?.githubOAuthClientId)
  const candidate = fromExtra ?? getGitHubOAuthClientIdFromProcessEnv()
  if (!candidate) return null
  return isProbablyGitHubOAuthClientId(candidate) ? candidate : null
}

export function getGitHubOAuthClientIdStatus():
  | { ok: true; clientId: string }
  | { ok: false; error: string } {
  const clientId = getGitHubOAuthClientId()
  if (!clientId) {
    // Expo Go note: EAS profile env vars are not injected here.
    const isExpoGo = (Constants as any)?.appOwnership === "expo"
    if (isExpoGo) {
      return {
        ok: false,
        error:
          "GitHub login isn’t configured for Expo Go. Set EXPO_PUBLIC_GITHUB_OAUTH_CLIENT_ID and restart Expo.",
      }
    }

    return { ok: false, error: GITHUB_LOGIN_NOT_CONFIGURED_MESSAGE }
  }
  return { ok: true, clientId }
}
