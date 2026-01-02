/**
 * Unit tests for GitHub Configuration Validation
 * Tests the Zod-based validation for GitHub sync configuration
 */

import { validateGitHubConfig } from "./github-config-validation"

describe("GitHub Config Validation", () => {
  describe("Repository validation", () => {
    it('should return "Repository must be in format: owner/repo" for invalid repo format', () => {
      const result = validateGitHubConfig({
        token: "ghp_validtoken123",
        repo: "invalid-repo-format",
        branch: "main",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.repo).toBe("Repository must be in format: owner/repo")
      }
    })

    it('should return "Repository must be in format: owner/repo" for repo with multiple slashes', () => {
      const result = validateGitHubConfig({
        token: "ghp_validtoken123",
        repo: "owner/repo/extra",
        branch: "main",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.repo).toBe("Repository must be in format: owner/repo")
      }
    })

    it('should return "Repository is required" for empty repo', () => {
      const result = validateGitHubConfig({
        token: "ghp_validtoken123",
        repo: "",
        branch: "main",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.repo).toBe("Repository is required")
      }
    })
  })

  describe("Token validation", () => {
    it('should return "Invalid token format" for token without valid prefix', () => {
      const result = validateGitHubConfig({
        token: "invalid_token_format",
        repo: "owner/repo",
        branch: "main",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.token).toBe("Invalid token format")
      }
    })

    it('should return "Token is required" for empty token', () => {
      const result = validateGitHubConfig({
        token: "",
        repo: "owner/repo",
        branch: "main",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.token).toBe("Token is required")
      }
    })
  })

  describe("Branch validation", () => {
    it('should return "Branch is required" for empty branch', () => {
      const result = validateGitHubConfig({
        token: "ghp_validtoken123",
        repo: "owner/repo",
        branch: "",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.branch).toBe("Branch is required")
      }
    })

    it('should return "Invalid branch name" for branch with invalid characters', () => {
      const result = validateGitHubConfig({
        token: "ghp_validtoken123",
        repo: "owner/repo",
        branch: "branch with spaces",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.branch).toBe("Invalid branch name")
      }
    })
  })

  describe("Valid configurations", () => {
    it("should return success for valid config with ghp_ token", () => {
      const result = validateGitHubConfig({
        token: "ghp_validtoken123456789",
        repo: "owner/repo",
        branch: "main",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.token).toBe("ghp_validtoken123456789")
        expect(result.data.repo).toBe("owner/repo")
        expect(result.data.branch).toBe("main")
      }
    })

    it("should return success for valid config with github_pat_ token", () => {
      const result = validateGitHubConfig({
        token: "github_pat_validtoken123456789",
        repo: "my-org/my-repo",
        branch: "develop",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.token).toBe("github_pat_validtoken123456789")
      }
    })

    it("should return success for valid config with gho_ token", () => {
      const result = validateGitHubConfig({
        token: "gho_oauthtoken123456789",
        repo: "user/project",
        branch: "feature/new-feature",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.token).toBe("gho_oauthtoken123456789")
      }
    })

    it("should accept repo names with dots, underscores, and hyphens", () => {
      const result = validateGitHubConfig({
        token: "ghp_validtoken123",
        repo: "my_org.name/my-repo_name.js",
        branch: "main",
      })

      expect(result.success).toBe(true)
    })

    it("should accept branch names with slashes", () => {
      const result = validateGitHubConfig({
        token: "ghp_validtoken123",
        repo: "owner/repo",
        branch: "feature/my-feature/sub-branch",
      })

      expect(result.success).toBe(true)
    })
  })
})
