import { z } from "zod"
import { TFunction } from "i18next"

/**
 * Valid GitHub token prefixes
 * - ghp_ : Personal access tokens (classic)
 * - github_pat_ : Fine-grained personal access tokens
 * - gho_ : OAuth tokens
 */
const GITHUB_TOKEN_PREFIXES = ["ghp_", "github_pat_", "gho_"]

/**
 * Creates a Zod schema for GitHub configuration validation with localized messages.
 * Validates token format, repository format, and branch name.
 *
 * @param t - Translation function from i18next
 * @returns Zod schema for GitHub config validation
 */
export function getGithubConfigSchema(t: TFunction) {
  return z.object({
    token: z
      .string()
      .min(1, t("validation.github.tokenRequired"))
      .refine((val) => GITHUB_TOKEN_PREFIXES.some((prefix) => val.startsWith(prefix)), {
        message: t("validation.github.tokenInvalid"),
      }),
    repo: z
      .string()
      .min(1, t("validation.github.repoRequired"))
      .regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, {
        message: t("validation.github.repoFormat"),
      }),
    branch: z
      .string()
      .min(1, t("validation.github.branchRequired"))
      .regex(/^[a-zA-Z0-9_./-]+$/, {
        message: t("validation.github.branchInvalid"),
      }),
  })
}

/**
 * Default schema with English messages (for tests and backward compatibility)
 */
export const githubConfigSchema = z.object({
  token: z
    .string()
    .min(1, "Token is required")
    .refine((val) => GITHUB_TOKEN_PREFIXES.some((prefix) => val.startsWith(prefix)), {
      message: "Invalid token format",
    }),
  repo: z
    .string()
    .min(1, "Repository is required")
    .regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, {
      message: "Repository must be in format: owner/repo",
    }),
  branch: z
    .string()
    .min(1, "Branch is required")
    .regex(/^[a-zA-Z0-9_./-]+$/, {
      message: "Invalid branch name",
    }),
})

export type GitHubConfigFormData = z.infer<typeof githubConfigSchema>

/**
 * Validation result type
 */
export type GitHubConfigValidationResult =
  | { success: true; data: GitHubConfigFormData }
  | { success: false; errors: Record<string, string> }

/**
 * Validate GitHub configuration with optional localization.
 * @param data - Form data to validate
 * @param t - Optional translation function for localized messages
 * @returns Validation result with success/data or errors
 */
export function validateGitHubConfig(
  data: unknown,
  t?: TFunction
): GitHubConfigValidationResult {
  const schema = t ? getGithubConfigSchema(t) : githubConfigSchema
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join(".")
    // Only keep the first error for each field
    if (!errors[path]) {
      errors[path] = issue.message
    }
  }

  return { success: false, errors }
}
