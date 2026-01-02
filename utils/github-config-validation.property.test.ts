/**
 * Property-based tests for GitHub Configuration Validation
 *
 * Feature: payment-settings-improvements, Property 9: GitHub repository format validation
 * Validates: Requirements 8.1, 8.2
 */

import fc from "fast-check"
import { validateGitHubConfig } from "./github-config-validation"

// Generator for valid owner/repo name characters (alphanumeric, underscore, hyphen, dot)
const validRepoCharArb = fc.constantFrom(
  ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-".split("")
)

// Generator for valid owner/repo name (1-20 characters)
const validRepoNameArb = fc
  .array(validRepoCharArb, { minLength: 1, maxLength: 20 })
  .map((chars) => chars.join(""))

// Generator for valid repository format (owner/repo)
const validRepoArb = fc
  .tuple(validRepoNameArb, validRepoNameArb)
  .map(([owner, repo]) => `${owner}/${repo}`)

// Generator for valid GitHub token prefixes
const validTokenPrefixArb = fc.constantFrom("ghp_", "github_pat_", "gho_")

// Generator for token suffix (alphanumeric characters)
const tokenSuffixArb = fc
  .array(
    fc.constantFrom(
      ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("")
    ),
    { minLength: 10, maxLength: 40 }
  )
  .map((chars) => chars.join(""))

// Generator for valid GitHub token
const validTokenArb = fc
  .tuple(validTokenPrefixArb, tokenSuffixArb)
  .map(([prefix, suffix]) => `${prefix}${suffix}`)

// Generator for valid branch name characters
const validBranchCharArb = fc.constantFrom(
  ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_./-".split("")
)

// Generator for valid branch name
const validBranchArb = fc
  .array(validBranchCharArb, { minLength: 1, maxLength: 30 })
  .map((chars) => chars.join(""))

// Generator for invalid repo formats (no slash, multiple slashes, empty parts)
const invalidRepoArb = fc.oneof(
  // No slash at all
  validRepoNameArb,
  // Multiple slashes
  fc
    .tuple(validRepoNameArb, validRepoNameArb, validRepoNameArb)
    .map(([a, b, c]) => `${a}/${b}/${c}`),
  // Empty owner
  validRepoNameArb.map((repo) => `/${repo}`),
  // Empty repo
  validRepoNameArb.map((owner) => `${owner}/`),
  // Just a slash
  fc.constant("/"),
  // Empty string
  fc.constant("")
)

// Generator for invalid token (doesn't start with valid prefix)
const invalidTokenArb = fc.oneof(
  // Random string without valid prefix
  fc
    .array(
      fc.constantFrom(
        ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("")
      ),
      { minLength: 10, maxLength: 40 }
    )
    .map((chars) => chars.join(""))
    .filter(
      (s) =>
        !s.startsWith("ghp_") && !s.startsWith("github_pat_") && !s.startsWith("gho_")
    ),
  // Empty string
  fc.constant("")
)

describe("GitHub Config Validation Properties", () => {
  /**
   * Property 9: GitHub repository format validation
   * For any string input for repository field, the validation SHALL accept only strings
   * matching the pattern "owner/repo" where both owner and repo contain valid characters
   * (alphanumeric, underscore, hyphen, dot).
   *
   * Feature: payment-settings-improvements, Property 9: GitHub repository format validation
   * Validates: Requirements 8.1, 8.2
   */
  describe("Property 9: GitHub repository format validation", () => {
    it("should accept valid owner/repo format", () => {
      fc.assert(
        fc.property(
          validRepoArb,
          validTokenArb,
          validBranchArb,
          (repo, token, branch) => {
            const result = validateGitHubConfig({ token, repo, branch })
            return result.success === true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should reject invalid repository formats", () => {
      fc.assert(
        fc.property(
          invalidRepoArb,
          validTokenArb,
          validBranchArb,
          (repo, token, branch) => {
            const result = validateGitHubConfig({ token, repo, branch })
            // Should fail validation
            if (result.success) return false
            // Should have repo error
            return "repo" in result.errors
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should accept tokens with valid prefixes (ghp_, github_pat_, gho_)", () => {
      fc.assert(
        fc.property(
          validTokenArb,
          validRepoArb,
          validBranchArb,
          (token, repo, branch) => {
            const result = validateGitHubConfig({ token, repo, branch })
            return result.success === true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should reject tokens without valid prefixes", () => {
      fc.assert(
        fc.property(
          invalidTokenArb,
          validRepoArb,
          validBranchArb,
          (token, repo, branch) => {
            const result = validateGitHubConfig({ token, repo, branch })
            // Should fail validation
            if (result.success) return false
            // Should have token error
            return "token" in result.errors
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should validate that repo contains exactly one slash separating owner and repo", () => {
      fc.assert(
        fc.property(validRepoArb, (repo) => {
          // Valid repos should have exactly one slash
          const slashCount = (repo.match(/\//g) || []).length
          return slashCount === 1
        }),
        { numRuns: 100 }
      )
    })

    it("should ensure both owner and repo parts are non-empty in valid repos", () => {
      fc.assert(
        fc.property(validRepoArb, (repo) => {
          const [owner, repoName] = repo.split("/")
          return owner.length > 0 && repoName.length > 0
        }),
        { numRuns: 100 }
      )
    })
  })
})
