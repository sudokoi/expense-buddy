import { secureStorage } from "../secure-storage"
import type { CredentialEntry, CredentialStore } from "./provider-types"

const KEY_PREFIX = "credential."

/**
 * Old secureStorage key that stores the GitHub PAT as a raw string.
 * Used as fallback during Phase 3 migration so existing users don't lose access.
 */
const LEGACY_GITHUB_TOKEN_KEY = "github_pat"

function buildKey(credentialId: string): string {
  return `${KEY_PREFIX}${credentialId}`
}

function now(): string {
  return new Date().toISOString()
}

export const credentialStore: CredentialStore = {
  async get(credentialId: string): Promise<CredentialEntry | null> {
    const raw = await secureStorage.getItem(buildKey(credentialId))
    if (raw) {
      try {
        return JSON.parse(raw) as CredentialEntry
      } catch {
        return null
      }
    }

    if (credentialId === "github_pat") {
      const legacyToken = await secureStorage.getItem(LEGACY_GITHUB_TOKEN_KEY)
      if (legacyToken) {
        const entry: CredentialEntry = {
          credentialId: "github_pat",
          kind: "github_pat",
          data: { token: legacyToken },
          createdAt: now(),
          updatedAt: now(),
        }
        await secureStorage.setItem(buildKey("github_pat"), JSON.stringify(entry))
        return entry
      }
    }

    return null
  },

  async save(
    credentialId: string,
    entry: Omit<CredentialEntry, "createdAt" | "updatedAt">
  ): Promise<void> {
    const existing = await this.get(credentialId)
    const stored: CredentialEntry = {
      ...entry,
      credentialId,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    }
    await secureStorage.setItem(buildKey(credentialId), JSON.stringify(stored))
  },

  async delete(credentialId: string): Promise<void> {
    await secureStorage.deleteItem(buildKey(credentialId))
  },
}
