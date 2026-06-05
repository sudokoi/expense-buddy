import { useCallback } from "react"
import { useSelector } from "@xstate/store-react"
import { useStoreContext } from "../store-provider"
import { ProviderConnectionStatus } from "../provider-store"
import type {
  ProviderConfig,
  SyncProvidersState,
} from "../../services/sync/provider-types"
import { createProvider } from "../../services/sync/provider-registry"
import { SyncProviderError } from "../../services/sync/provider-types"

export enum ProviderCardStatus {
  ActiveReconciled = "active_reconciled",
  ActiveUnreconciled = "active_unreconciled",
  Inactive = "inactive",
}

export interface ProviderCardState {
  config: ProviderConfig
  status: ProviderCardStatus
  connectionStatus: ProviderConnectionStatus
  connectionLabel?: string
  connectionError?: string
}

export function useProviderManagement() {
  const { providerStore, settingsStore } = useStoreContext()

  const providers = useSelector(providerStore, (s) => s.context.providers)
  const activeProviderId = useSelector(providerStore, (s) => s.context.activeProviderId)
  const reconciledMap = useSelector(providerStore, (s) => s.context.reconciledMap)
  const connectionResults = useSelector(providerStore, (s) => s.context.connectionResults)

  const hasActiveProvider = activeProviderId !== null

  const providerCards: ProviderCardState[] = providers.map((config) => {
    const isActive = config.id === activeProviderId
    const isReconciled = reconciledMap[config.id] ?? false
    const result = connectionResults[config.id]
    const status = isActive
      ? isReconciled
        ? ProviderCardStatus.ActiveReconciled
        : ProviderCardStatus.ActiveUnreconciled
      : ProviderCardStatus.Inactive

    return {
      config,
      status,
      connectionStatus: result?.status ?? ProviderConnectionStatus.Idle,
      connectionLabel: result?.label,
      connectionError: result?.error,
    }
  })

  const addProvider = useCallback(
    (config: ProviderConfig) => {
      providerStore.trigger.addProvider({ config })
    },
    [providerStore]
  )

  const removeProvider = useCallback(
    (id: string) => {
      const removed = providers.find((p) => p.id === id)
      providerStore.trigger.removeProvider({ id })
      if (removed?.kind === "github") {
        settingsStore.trigger.clearSyncConfig()
      }
    },
    [providerStore, providers, settingsStore]
  )

  const setActiveProvider = useCallback(
    (id: string | null) => {
      providerStore.trigger.setActiveProvider({ id })
    },
    [providerStore]
  )

  const markReconciled = useCallback(
    (id: string) => {
      providerStore.trigger.markReconciled({ id })
    },
    [providerStore]
  )

  const testConnection = useCallback(
    async (config: ProviderConfig) => {
      providerStore.trigger.setConnectionTesting({ providerId: config.id })
      try {
        const provider = createProvider(config)
        const result = await provider.testConnection()
        if (result.ok) {
          providerStore.trigger.setConnectionSuccess({
            providerId: config.id,
            label: result.label,
          })
        } else {
          providerStore.trigger.setConnectionFailed({
            providerId: config.id,
            error: result.error.message,
          })
        }
        return result
      } catch (error) {
        const msg = error instanceof SyncProviderError ? error.message : String(error)
        providerStore.trigger.setConnectionFailed({
          providerId: config.id,
          error: msg,
        })
        return { ok: false as const, error: msg }
      }
    },
    [providerStore]
  )

  const clearConnectionResult = useCallback(
    (providerId: string) => {
      providerStore.trigger.clearConnectionResult({ providerId })
    },
    [providerStore]
  )

  const loadProviders = useCallback(
    (state: SyncProvidersState, reconciled: Record<string, boolean>) => {
      providerStore.trigger.loadProviders({
        providers: state.providers,
        activeProviderId: state.activeProviderId,
        reconciledMap: reconciled,
      })
    },
    [providerStore]
  )

  return {
    providerCards,
    providers,
    activeProviderId,
    hasActiveProvider,
    addProvider,
    removeProvider,
    setActiveProvider,
    markReconciled,
    testConnection,
    clearConnectionResult,
    loadProviders,
  }
}
