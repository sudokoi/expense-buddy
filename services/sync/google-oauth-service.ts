import * as WebBrowser from "expo-web-browser"
import { makeRedirectUri, loadAsync } from "expo-auth-session"
import { credentialStore } from "./credential-store"
import type { CredentialEntry } from "./provider-types"

WebBrowser.maybeCompleteAuthSession()

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"

const googleDiscovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
}

export interface GoogleDriveTokenResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export class GoogleOAuthError extends Error {
  constructor(
    readonly stage: "auth" | "exchange",
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "GoogleOAuthError"
  }
}

function getRedirectUri(): string {
  return makeRedirectUri()
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string
): Promise<GoogleDriveTokenResult> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }).toString(),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "unknown")
    throw new GoogleOAuthError(
      "exchange",
      `HTTP_${response.status}`,
      `Token exchange failed: ${text}`
    )
  }

  const data = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }

  if (!data.access_token) {
    throw new GoogleOAuthError(
      "exchange",
      "NO_ACCESS_TOKEN",
      "No access token in response"
    )
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? "",
    expiresIn: data.expires_in ?? 3600,
  }
}

function storeTokens(
  credentialId: string,
  tokens: GoogleDriveTokenResult,
  clientId: string
): Promise<void> {
  const expiresAt = String(Date.now() + tokens.expiresIn * 1000)
  return credentialStore.save(credentialId, {
    credentialId,
    kind: "google_oauth",
    data: {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: expiresAt,
      client_id: clientId,
    },
  })
}

export interface GoogleDriveOAuthResult {
  providerId: string
  accountEmail: string
}

export async function initiateGoogleDriveOAuth(
  clientId: string
): Promise<GoogleDriveOAuthResult> {
  const redirectUri = getRedirectUri()

  const request = await loadAsync(
    {
      clientId,
      scopes: [DRIVE_FILE_SCOPE],
      redirectUri,
      extraParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
    googleDiscovery
  )

  const result = await request.promptAsync(googleDiscovery)

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new GoogleOAuthError("auth", "CANCELLED", "User cancelled the OAuth flow")
  }

  if (result.type === "error") {
    throw new GoogleOAuthError(
      "auth",
      result.error?.code ?? "UNKNOWN",
      result.error?.message ?? "OAuth error"
    )
  }

  if (result.type !== "success" || !result.params?.code) {
    throw new GoogleOAuthError("auth", "NO_CODE", "No authorization code received")
  }

  const tokens = await exchangeCodeForTokens(
    result.params.code,
    request.codeVerifier ?? "",
    clientId,
    redirectUri
  )

  const providerId = `google_drive_${Date.now()}`

  await storeTokens(providerId, tokens, clientId)

  let accountEmail = ""
  if (tokens.accessToken) {
    try {
      const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })
      if (info.ok) {
        const profile = (await info.json()) as { email?: string }
        accountEmail = profile.email ?? ""
      }
    } catch {
      // Non-critical
    }
  }

  return { providerId, accountEmail }
}

export async function getGoogleDriveTokenInfo(
  credentialId: string
): Promise<StoredTokenInfo | null> {
  const entry: CredentialEntry | null = await credentialStore.get(credentialId)
  if (!entry) return null

  return {
    credentialId: entry.credentialId,
    email: entry.data["account_email"] ?? null,
    expiresAt: entry.data["expires_at"] ? parseInt(entry.data["expires_at"], 10) : null,
  }
}

export interface StoredTokenInfo {
  credentialId: string
  email: string | null
  expiresAt: number | null
}
