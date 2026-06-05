import { createStore } from "@xstate/store"
import type { ProviderConfig, SyncProvidersState } from "../services/sync/provider-types"
import { providerSettingsStore } from "../services/sync/provider-settings-store"
import { isProviderReconciled, markProviderReconciled } from "../services/sync-queue"
import { createProvider } from "../services/sync/provider-registry"

export enum ProviderConnectionStatus {
  Idle = "idle",
  Testing = "testing",
  Success = "success",
  Failed = "failed",
}

export interface ConnectionResultState {
  status: ProviderConnectionStatus
  label?: string
  error?: string
}

export interface ProviderStoreContext {
  providers: ProviderConfig[]
  activeProviderId: string | null
  reconciledMap: Record<string, boolean>
  connectionResults: Record<string, ConnectionResultState>
}

export const providerStore = createStore({
  context: {
    providers: [],
    activeProviderId: null,
    reconciledMap: {},
    connectionResults: {},
  } as ProviderStoreContext,

  on: {
    loadProviders: (
      context,
      event: {
        providers: ProviderConfig[]
        activeProviderId: string | null
        reconciledMap: Record<string, boolean>
      }
    ) => ({
      ...context,
      providers: event.providers,
      activeProviderId: event.activeProviderId,
      reconciledMap: event.reconciledMap,
    }),

    addProvider: (context, event: { config: ProviderConfig }, enqueue) => {
      enqueue.effect(async () => {
        await providerSettingsStore.addProvider(event.config)
      })

      const exists = context.providers.some((p) => p.id === event.config.id)
      const providers = exists
        ? context.providers.map((p) => (p.id === event.config.id ? event.config : p))
        : [...context.providers, event.config]
      return { ...context, providers }
    },

    removeProvider: (context, event: { id: string }, enqueue) => {
      enqueue.effect(async () => {
        await providerSettingsStore.removeProvider(event.id)
      })

      const providers = context.providers.filter((p) => p.id !== event.id)
      const activeProviderId =
        context.activeProviderId === event.id
          ? (providers[0]?.id ?? null)
          : context.activeProviderId

      const nextResults = { ...context.connectionResults }
      delete nextResults[event.id]

      const nextReconciled = { ...context.reconciledMap }
      delete nextReconciled[event.id]

      return {
        ...context,
        providers,
        activeProviderId,
        connectionResults: nextResults,
        reconciledMap: nextReconciled,
      }
    },

    setActiveProvider: (context, event: { id: string | null }, enqueue) => {
      enqueue.effect(async () => {
        await providerSettingsStore.setActiveProvider(event.id)
      })

      return { ...context, activeProviderId: event.id }
    },

    markReconciled: (context, event: { id: string }, enqueue) => {
      enqueue.effect(async () => {
        await markProviderReconciled(event.id)
      })

      return {
        ...context,
        reconciledMap: { ...context.reconciledMap, [event.id]: true },
      }
    },

    setConnectionTesting: (context, event: { providerId: string }) => ({
      ...context,
      connectionResults: {
        ...context.connectionResults,
        [event.providerId]: { status: ProviderConnectionStatus.Testing },
      },
    }),

    setConnectionSuccess: (
      context,
      event: { providerId: string; label: string }
    ) => ({
      ...context,
      connectionResults: {
        ...context.connectionResults,
        [event.providerId]: {
          status: ProviderConnectionStatus.Success,
          label: event.label,
        },
      },
    }),

    setConnectionFailed: (
      context,
      event: { providerId: string; error: string }
    ) => ({
      ...context,
      connectionResults: {
        ...context.connectionResults,
        [event.providerId]: {
          status: ProviderConnectionStatus.Failed,
          error: event.error,
        },
      },
    }),

    clearConnectionResult: (context, event: { providerId: string }) => {
      const next = { ...context.connectionResults }
      delete next[event.providerId]
      return { ...context, connectionResults: next }
    },
  },
})

export type ProviderStore = typeof providerStore

export async function initializeProviderStore(
  store: ProviderStore = providerStore
): Promise<void> {
  try {
    const state = await providerSettingsStore.load()
    const reconciledMap: Record<string, boolean> = {}
    for (const p of state.providers) {
      reconciledMap[p.id] = await isProviderReconciled(p.id)
    }
    store.trigger.loadProviders({
      providers: state.providers,
      activeProviderId: state.activeProviderId,
      reconciledMap,
    })
  } catch (error) {
    console.warn("Failed to initialize provider store:", error)
    store.trigger.loadProviders({
      providers: [],
      activeProviderId: null,
      reconciledMap: {},
    })
  }
}
