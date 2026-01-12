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

export function getGitHubOAuthClientId(): string | null {
  const extra = getExpoExtra()
  const value = extra.auth?.githubOAuthClientId
  if (!value) return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}

export function getGitHubOAuthClientIdStatus():
  | { ok: true; clientId: string }
  | { ok: false; error: string } {
  const clientId = getGitHubOAuthClientId()
  if (!clientId) {
    return { ok: false, error: GITHUB_LOGIN_NOT_CONFIGURED_MESSAGE }
  }
  return { ok: true, clientId }
}
