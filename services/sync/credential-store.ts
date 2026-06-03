import { secureStorage } from "../secure-storage"
import type { CredentialEntry, CredentialStore } from "./provider-types"

const KEY_PREFIX = "credential."

function buildKey(credentialId: string): string {
  return `${KEY_PREFIX}${credentialId}`
}

function now(): string {
  return new Date().toISOString()
}

export const credentialStore: CredentialStore = {
  async get(credentialId: string): Promise<CredentialEntry | null> {
    const raw = await secureStorage.getItem(buildKey(credentialId))
    if (!raw) return null
    try {
      return JSON.parse(raw) as CredentialEntry
    } catch {
      return null
    }
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
