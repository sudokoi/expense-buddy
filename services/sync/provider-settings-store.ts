import { getItem, setItem } from "../storage"
import type { ProviderConfig, SyncProvidersState } from "./provider-types"
import { providerStateStore } from "./provider-state-store"
import { credentialStore } from "./credential-store"

const STORAGE_KEY = "sync.provider.state"

const DEFAULT_STATE: SyncProvidersState = {
  activeProviderId: null,
  providers: [],
}

export const providerSettingsStore = {
  async load(): Promise<SyncProvidersState> {
    try {
      const raw = await getItem(STORAGE_KEY)
      if (!raw) return { ...DEFAULT_STATE }
      const parsed = JSON.parse(raw) as SyncProvidersState
      return {
        activeProviderId: parsed.activeProviderId ?? null,
        providers: Array.isArray(parsed.providers) ? parsed.providers : [],
      }
    } catch (error) {
      console.warn("Failed to load provider settings store, using defaults:", error)
      return { ...DEFAULT_STATE }
    }
  },

  async save(state: SyncProvidersState): Promise<void> {
    await setItem(STORAGE_KEY, JSON.stringify(state))
  },

  async addProvider(config: ProviderConfig): Promise<void> {
    const state = await this.load()
    const existing = state.providers.find((p) => p.id === config.id)
    if (existing) {
      state.providers = state.providers.map((p) => (p.id === config.id ? config : p))
    } else {
      state.providers = [...state.providers, config]
    }
    await this.save(state)
  },

  async removeProvider(id: string): Promise<void> {
    const state = await this.load()
    const removed = state.providers.find((p) => p.id === id)
    state.providers = state.providers.filter((p) => p.id !== id)
    if (state.activeProviderId === id) {
      state.activeProviderId = state.providers[0]?.id ?? null
    }
    await this.save(state)
    await providerStateStore.clearProvider(id)
    if (removed?.credentialId) {
      await credentialStore.delete(removed.credentialId)
    }
  },

  async setActiveProvider(id: string | null): Promise<void> {
    const state = await this.load()
    state.activeProviderId = id
    await this.save(state)
  },

  async getActiveConfig(): Promise<ProviderConfig | null> {
    const state = await this.load()
    if (!state.activeProviderId) return null
    return state.providers.find((p) => p.id === state.activeProviderId) ?? null
  },
}
