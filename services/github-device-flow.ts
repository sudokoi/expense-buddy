import i18next from "i18next"

export type GitHubDeviceCode = {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval: number
}

export type GitHubDeviceTokenSuccess = {
  access_token: string
  token_type: "bearer" | string
  scope?: string
}

export type GitHubDeviceTokenError = {
  error:
    | "authorization_pending"
    | "slow_down"
    | "expired_token"
    | "access_denied"
    | string
  error_description?: string
  error_uri?: string
}

export type GitHubDeviceTokenPollResult =
  | { type: "success"; token: GitHubDeviceTokenSuccess }
  | { type: "pending" }
  | { type: "slow_down" }
  | { type: "expired" }
  | { type: "denied" }
  | { type: "error"; message: string }

export async function requestGitHubDeviceCode(params: {
  clientId: string
  scope: string
}): Promise<GitHubDeviceCode> {
  const clientId = String(params.clientId || "").trim()

  const body = new URLSearchParams({
    client_id: clientId,
    scope: params.scope,
  })

  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    // React Native fetch does not reliably serialize URLSearchParams.
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")

    throw new Error(
      i18next.t("githubDeviceFlow.errors.codeRequestFailed", {
        status: response.status,
        detail: text || response.statusText,
      })
    )
  }

  const data = (await response.json().catch(() => null)) as GitHubDeviceCode | null
  if (!data?.device_code || !data?.user_code || !data?.verification_uri) {
    throw new Error(i18next.t("githubDeviceFlow.errors.missingFields"))
  }

  return data
}

export async function pollGitHubDeviceAccessTokenOnce(params: {
  clientId: string
  deviceCode: string
}): Promise<GitHubDeviceTokenPollResult> {
  const clientId = String(params.clientId || "").trim()
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: params.deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  })

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    // React Native fetch does not reliably serialize URLSearchParams.
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(
      i18next.t("githubDeviceFlow.errors.tokenRequestFailed", {
        status: response.status,
        detail: text || response.statusText,
      })
    )
  }

  const data = (await response.json().catch(() => null)) as
    | (GitHubDeviceTokenSuccess & Partial<GitHubDeviceTokenError>)
    | GitHubDeviceTokenError
    | null

  if (!data) {
    return {
      type: "error",
      message: i18next.t("githubDeviceFlow.errors.tokenResponseEmpty"),
    }
  }

  if ("access_token" in data && typeof data.access_token === "string") {
    return { type: "success", token: data as GitHubDeviceTokenSuccess }
  }

  const error = (data as GitHubDeviceTokenError).error
  const description = (data as GitHubDeviceTokenError).error_description

  if (error === "authorization_pending") return { type: "pending" }
  if (error === "slow_down") return { type: "slow_down" }
  if (error === "expired_token") return { type: "expired" }
  if (error === "access_denied") return { type: "denied" }

  return {
    type: "error",
    message: i18next.t("githubDeviceFlow.errors.tokenError", {
      error,
      description: description || "",
    }),
  }
}
