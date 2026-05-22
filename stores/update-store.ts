import { createStore, createStoreConfig } from "@xstate/store"
import { Linking } from "react-native"
import { APP_CONFIG } from "../constants/app-config"
import {
  checkForUpdates,
  checkForUpdatesOnLaunch,
  getDismissedVersion,
  setDismissedVersion,
  shouldShowUpdateNotification,
  UpdateInfo,
} from "../services/update-checker"
import {
  completePlayStoreUpdate,
  PlayStoreInstallStatus,
  startPlayStoreFlexibleUpdate,
  startPlayStoreImmediateUpdate,
  subscribeToPlayStoreUpdateStatus,
} from "../services/play-store-update"
import { notificationStore } from "./notification-store"

export type UpdateSource = "github" | "play-store"

export interface PerformUpdateActionOptions {
  installStatus: PlayStoreInstallStatus
  supportsFlexibleUpdate?: boolean
  supportsImmediateUpdate?: boolean
  releaseUrl?: string
  updateSource: UpdateSource | null
}

export async function performUpdateAction({
  installStatus,
  supportsFlexibleUpdate,
  supportsImmediateUpdate,
  releaseUrl,
  updateSource,
}: PerformUpdateActionOptions): Promise<void> {
  if (updateSource === "github") {
    const targetUrl = releaseUrl || `${APP_CONFIG.github.url}/releases`
    const canOpen = await Linking.canOpenURL(targetUrl)

    if (!canOpen) {
      notificationStore.trigger.addNotification({
        message: `Could not open release page. Please visit: ${targetUrl}`,
        notificationType: "error",
        duration: 8000,
      })
      return
    }

    await Linking.openURL(targetUrl)
    return
  }

  if (installStatus === "downloaded") {
    await completePlayStoreUpdate()
    return
  }

  if (
    installStatus === "downloading" ||
    installStatus === "installing" ||
    installStatus === "pending"
  ) {
    notificationStore.trigger.addNotification({
      message: "Update is already downloading in the background.",
      notificationType: "info",
    })
    return
  }

  if (supportsImmediateUpdate !== false) {
    await startPlayStoreImmediateUpdate()
    return
  }

  if (supportsFlexibleUpdate) {
    await startPlayStoreFlexibleUpdate()
    return
  }

  const canOpenPlayStore = await Linking.canOpenURL(APP_CONFIG.playStore.url)
  if (!canOpenPlayStore) {
    throw new Error("No supported Play Store update flow is currently available.")
  }

  await Linking.openURL(APP_CONFIG.playStore.url)
}

export interface UpdateStoreContext {
  updateAvailable: boolean
  latestVersion: string | null
  showBanner: boolean
  updateCheckCompleted: boolean
  installStatus: PlayStoreInstallStatus
  releaseUrl: string | undefined
  updateSource: UpdateSource | null
  supportsFlexibleUpdate: boolean
  supportsImmediateUpdate: boolean
}

type UpdateStoreEvents = {
  checkForUpdatesOnLaunch: AsyncTriggerCallbacks & {
    dispatch: Pick<UpdateStoreDispatch, "applyUpdateInfo" | "markUpdateCheckCompleted">
  }
  checkForUpdatesManually: AsyncTriggerCallbacks & {
    dispatch: Pick<UpdateStoreDispatch, "applyUpdateInfo" | "clearUpdateInfo">
  }
  dismissBanner: AsyncTriggerCallbacks & { latestVersion: string | null }
  applyUpdateInfo: { updateInfo: UpdateInfo; showBanner: boolean }
  clearUpdateInfo: Record<string, never>
  setInstallStatus: { status: PlayStoreInstallStatus }
  setShowBanner: { showBanner: boolean }
  markUpdateCheckCompleted: { completed: boolean }
}

interface AsyncTriggerCallbacks {
  resolve?: () => void
  reject?: (error: unknown) => void
}

interface UpdateStoreDispatch {
  applyUpdateInfo: (payload: { updateInfo: UpdateInfo; showBanner: boolean }) => void
  clearUpdateInfo: () => void
  markUpdateCheckCompleted: (payload: { completed: boolean }) => void
}

const INITIAL_UPDATE_CONTEXT: UpdateStoreContext = {
  updateAvailable: false,
  latestVersion: null,
  showBanner: false,
  updateCheckCompleted: false,
  installStatus: "unknown",
  releaseUrl: undefined,
  updateSource: null,
  supportsFlexibleUpdate: false,
  supportsImmediateUpdate: false,
}

function toNextContext(
  context: UpdateStoreContext,
  updateInfo: UpdateInfo,
  showBanner: boolean
): UpdateStoreContext {
  if (!updateInfo.hasUpdate) {
    return {
      ...context,
      updateAvailable: false,
      latestVersion: null,
      showBanner: false,
      installStatus: "unknown",
      releaseUrl: undefined,
      updateSource: null,
      supportsFlexibleUpdate: false,
      supportsImmediateUpdate: false,
    }
  }

  return {
    ...context,
    updateAvailable: true,
    latestVersion: updateInfo.latestVersion ?? null,
    showBanner,
    installStatus: updateInfo.installStatus ?? "unknown",
    releaseUrl: updateInfo.releaseUrl,
    updateSource: updateInfo.source ?? null,
    supportsFlexibleUpdate:
      updateInfo.source === "play-store" && updateInfo.isFlexibleUpdateAllowed === true,
    supportsImmediateUpdate:
      updateInfo.source === "play-store" && updateInfo.isImmediateUpdateAllowed === true,
  }
}

const updateStoreConfig = createStoreConfig<
  UpdateStoreContext,
  UpdateStoreEvents,
  Record<string, never>
>({
  context: INITIAL_UPDATE_CONTEXT,

  on: {
    checkForUpdatesOnLaunch: (context, event, enqueue) => {
      enqueue.effect(async () => {
        let error: unknown

        try {
          const updateInfo = await checkForUpdatesOnLaunch()
          if (!updateInfo) {
            return
          }

          const dismissedVersion = await getDismissedVersion()
          event.dispatch.applyUpdateInfo({
            updateInfo,
            showBanner: shouldShowUpdateNotification(updateInfo, dismissedVersion),
          })
        } catch (caughtError) {
          error = caughtError
        }

        event.dispatch.markUpdateCheckCompleted({ completed: true })
        if (error) {
          event.reject?.(error)
          return
        }

        event.resolve?.()
      })

      return context
    },

    checkForUpdatesManually: (context, event, enqueue) => {
      enqueue.effect(async () => {
        try {
          const updateInfo = await checkForUpdates()

          if (updateInfo.error && !updateInfo.hasUpdate) {
            notificationStore.trigger.addNotification({
              message: updateInfo.error,
              notificationType: "error",
            })
            event.resolve?.()
            return
          }

          if (updateInfo.hasUpdate) {
            event.dispatch.applyUpdateInfo({ updateInfo, showBanner: true })
            event.resolve?.()
            return
          }

          event.dispatch.clearUpdateInfo()
          notificationStore.trigger.addNotification({
            message: "You have the latest version!",
            notificationType: "success",
          })
          event.resolve?.()
        } catch (error) {
          event.reject?.(error)
        }
      })

      return context
    },

    dismissBanner: (context, event, enqueue) => {
      enqueue.effect(async () => {
        try {
          if (event.latestVersion) {
            await setDismissedVersion(event.latestVersion)
          }

          event.resolve?.()
        } catch (error) {
          event.reject?.(error)
        }
      })

      return {
        ...context,
        showBanner: false,
      }
    },

    applyUpdateInfo: (context, event: { updateInfo: UpdateInfo; showBanner: boolean }) =>
      toNextContext(context, event.updateInfo, event.showBanner),

    clearUpdateInfo: (context) => ({
      ...context,
      updateAvailable: false,
      latestVersion: null,
      showBanner: false,
      installStatus: "unknown" as PlayStoreInstallStatus,
      releaseUrl: undefined,
      updateSource: null,
      supportsFlexibleUpdate: false,
      supportsImmediateUpdate: false,
    }),

    setInstallStatus: (context, event: { status: PlayStoreInstallStatus }) => ({
      ...context,
      installStatus: event.status,
    }),

    setShowBanner: (context, event: { showBanner: boolean }) => ({
      ...context,
      showBanner: event.showBanner,
    }),

    markUpdateCheckCompleted: (context, event: { completed: boolean }) => ({
      ...context,
      updateCheckCompleted: event.completed,
    }),
  },
})

export const updateStore = createStore(updateStoreConfig)

export type UpdateStore = typeof updateStore

function getUpdateStoreDispatch(store: UpdateStore): UpdateStoreDispatch {
  return {
    applyUpdateInfo: (payload) => store.trigger.applyUpdateInfo(payload),
    clearUpdateInfo: () => store.trigger.clearUpdateInfo(),
    markUpdateCheckCompleted: (payload) =>
      store.trigger.markUpdateCheckCompleted(payload),
  }
}

let hasInitializedUpdateStore = false
let unsubscribeUpdateStatus: (() => void) | null = null

export function initializeUpdateStore(store: UpdateStore = updateStore): void {
  if (hasInitializedUpdateStore) {
    return
  }

  hasInitializedUpdateStore = true
  unsubscribeUpdateStatus = subscribeToPlayStoreUpdateStatus((event) => {
    store.trigger.setInstallStatus({ status: event.status })

    if (event.status === "downloaded") {
      notificationStore.trigger.addNotification({
        message: "Update downloaded. Tap update again to install it.",
        notificationType: "info",
        duration: 6000,
      })
    }

    if (event.status === "failed") {
      notificationStore.trigger.addNotification({
        message: "Play Store update failed. Please try again.",
        notificationType: "error",
      })
    }
  })
}

export function cleanupUpdateStore(): void {
  unsubscribeUpdateStatus?.()
  unsubscribeUpdateStatus = null
  hasInitializedUpdateStore = false
}

export async function runLaunchUpdateCheck(
  store: UpdateStore = updateStore
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    store.trigger.checkForUpdatesOnLaunch({
      dispatch: getUpdateStoreDispatch(store),
      resolve,
      reject,
    })
  })
}

export async function runManualUpdateCheck(
  store: UpdateStore = updateStore
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    store.trigger.checkForUpdatesManually({
      dispatch: getUpdateStoreDispatch(store),
      resolve,
      reject,
    })
  })
}

export async function dismissUpdateBanner(
  latestVersion: string | null,
  store: UpdateStore = updateStore
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    store.trigger.dismissBanner({ latestVersion, resolve, reject })
  })
}
