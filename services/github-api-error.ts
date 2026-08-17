import i18next from "../i18n"

export type GitHubErrorCode =
  | "AUTH"
  | "PERMISSION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "UNKNOWN"

export class GitHubApiError extends Error {
  public readonly status: number
  public readonly shouldSignOut: boolean
  public readonly isRateLimit: boolean

  constructor(params: {
    status: number
    message: string
    shouldSignOut: boolean
    isRateLimit: boolean
  }) {
    super(params.message)
    this.name = "GitHubApiError"
    this.status = params.status
    this.shouldSignOut = params.shouldSignOut
    this.isRateLimit = params.isRateLimit
  }
}

async function readGitHubErrorMessage(response: Response): Promise<string> {
  const data: { message?: string } = await response.json().catch(() => null)
  const message =
    data && typeof data === "object" && "message" in data
      ? String(data.message || "")
      : ""
  return message.trim()
}

function isRateLimitResponse(response: Response, message: string): boolean {
  const remaining = response.headers.get("x-ratelimit-remaining")
  if (remaining === "0") return true
  return message.toLowerCase().includes("rate limit")
}

function toFriendlyGitHubAuthMessage(params: {
  status: 401 | 403
  isRateLimit: boolean
  rawMessage?: string
}): string {
  if (params.status === 401) {
    return i18next.t("githubSync.errors.sessionExpired")
  }

  if (params.isRateLimit) {
    return i18next.t("githubSync.errors.rateLimit")
  }

  // 403 (non-rate-limit) typically means insufficient permissions or access restrictions.
  // For our UX, treat it as requiring re-auth so the user can re-authorize/select a different repo.
  return i18next.t("githubSync.errors.accessDenied")
}

export async function toGitHubApiError(response: Response): Promise<GitHubApiError> {
  const rawMessage = await readGitHubErrorMessage(response)
  const rateLimited = response.status === 403 && isRateLimitResponse(response, rawMessage)

  if (response.status === 401 || response.status === 403) {
    const status = response.status as 401 | 403
    return new GitHubApiError({
      status,
      isRateLimit: rateLimited,
      shouldSignOut: status === 401 || (status === 403 && !rateLimited),
      message: toFriendlyGitHubAuthMessage({
        status,
        isRateLimit: rateLimited,
        rawMessage,
      }),
    })
  }

  return new GitHubApiError({
    status: response.status,
    isRateLimit: false,
    shouldSignOut: false,
    message: rawMessage
      ? `GitHub API error (${response.status}): ${rawMessage}`
      : i18next.t("githubSync.errors.unknown", { status: response.status }),
  })
}

/**
 * Map HTTP status codes to user-friendly error messages and codes
 */
export function mapHttpError(
  status: number,
  message?: string
): { error: string; errorCode: GitHubErrorCode } {
  switch (status) {
    case 401:
      return { error: i18next.t("githubSync.errors.invalidToken"), errorCode: "AUTH" }
    case 403:
      return {
        error: message?.includes("rate limit")
          ? i18next.t("githubSync.errors.rateLimit")
          : i18next.t("githubSync.errors.permission"),
        errorCode: message?.includes("rate limit") ? "RATE_LIMIT" : "PERMISSION",
      }
    case 404:
      return {
        error: i18next.t("githubSync.errors.notFound"),
        errorCode: "NOT_FOUND",
      }
    case 409:
      return {
        error: i18next.t("githubSync.errors.conflict"),
        errorCode: "CONFLICT",
      }
    case 422:
      return {
        error: message
          ? `${i18next.t("githubSync.errors.invalidRequest")}: ${message}`
          : i18next.t("githubSync.errors.invalidRequest"),
        errorCode: "UNKNOWN",
      }
    case 429:
      return {
        error: i18next.t("githubSync.errors.rateLimit"),
        errorCode: "RATE_LIMIT",
      }
    default:
      return {
        error: message || i18next.t("githubSync.errors.unknown", { status }),
        errorCode: "UNKNOWN",
      }
  }
}
