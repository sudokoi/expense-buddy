import { createStore } from "@xstate/store"
import type { ProviderConfig } from "../services/sync/provider-types"
import { providerSettingsStore } from "../services/sync/provider-settings-store"
import { isProviderReconciled, markProviderReconciled } from "../services/sync-queue"
import { logAsync } from "../services/logger"

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
        logAsync(
          "INFO",
          "PROVIDER_STORE",
          `ADD_PROVIDER id=${event.config.id} kind=${event.config.kind}`
        )
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
        logAsync(
          "INFO",
          "PROVIDER_STORE",
          `REMOVE_PROVIDER id=${event.id} wasActive=${context.activeProviderId === event.id}`
        )
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
        logAsync("INFO", "PROVIDER_STORE", `SET_ACTIVE_PROVIDER id=${event.id ?? "null"}`)
      })

      return { ...context, activeProviderId: event.id }
    },

    markReconciled: (context, event: { id: string }, enqueue) => {
      enqueue.effect(async () => {
        await markProviderReconciled(event.id)
        logAsync("INFO", "PROVIDER_STORE", `MARK_PROVIDER_RECONCILED id=${event.id}`)
      })

      return {
        ...context,
        reconciledMap: { ...context.reconciledMap, [event.id]: true },
      }
    },

    setConnectionTesting: (context, event: { providerId: string }) => {
      logAsync("INFO", "PROVIDER_STORE", `CONNECTION_TESTING id=${event.providerId}`)
      return {
        ...context,
        connectionResults: {
          ...context.connectionResults,
          [event.providerId]: { status: ProviderConnectionStatus.Testing },
        },
      }
    },

    setConnectionSuccess: (context, event: { providerId: string; label: string }) => {
      logAsync(
        "INFO",
        "PROVIDER_STORE",
        `CONNECTION_SUCCESS id=${event.providerId} label=${event.label}`
      )
      return {
        ...context,
        connectionResults: {
          ...context.connectionResults,
          [event.providerId]: {
            status: ProviderConnectionStatus.Success,
            label: event.label,
          },
        },
      }
    },

    setConnectionFailed: (context, event: { providerId: string; error: string }) => {
      logAsync(
        "ERROR",
        "PROVIDER_STORE",
        `CONNECTION_FAILED id=${event.providerId} error=${event.error}`
      )
      return {
        ...context,
        connectionResults: {
          ...context.connectionResults,
          [event.providerId]: {
            status: ProviderConnectionStatus.Failed,
            error: event.error,
          },
        },
      }
    },

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
    logAsync(
      "INFO",
      "PROVIDER_STORE",
      `INITIALIZE providers=${state.providers.length} activeId=${state.activeProviderId ?? "null"} reconciled=${Object.values(reconciledMap).filter(Boolean).length}`
    )
  } catch (error) {
    logAsync("ERROR", "PROVIDER_STORE", `INITIALIZE_FAILED error=${error}`)
    console.warn("Failed to initialize provider store:", error)
    store.trigger.loadProviders({
      providers: [],
      activeProviderId: null,
      reconciledMap: {},
    })
  }
}
