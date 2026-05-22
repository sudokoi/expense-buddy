import { useCallback } from "react"
import { useSelector } from "@xstate/store-react"
import { useStoreContext } from "../stores/store-provider"
import {
  dismissUpdateBanner,
  performUpdateAction,
  runManualUpdateCheck,
} from "../stores/update-store"
import { notificationStore } from "../stores/notification-store"

export type { UpdateSource, PerformUpdateActionOptions } from "../stores/update-store"

export interface UseUpdateCheckResult {
  updateAvailable: boolean
  latestVersion: string | null
  showBanner: boolean
  updateCheckCompleted: boolean
  isUpdateReadyToInstall: boolean
  handleUpdate: () => Promise<void>
  handleDismiss: () => Promise<void>
  checkForUpdates: () => Promise<void>
}

export function useUpdateCheck(): UseUpdateCheckResult {
  const { updateStore } = useStoreContext()

  const updateAvailable = useSelector(
    updateStore,
    (state) => state.context.updateAvailable
  )
  const latestVersion = useSelector(updateStore, (state) => state.context.latestVersion)
  const showBanner = useSelector(updateStore, (state) => state.context.showBanner)
  const updateCheckCompleted = useSelector(
    updateStore,
    (state) => state.context.updateCheckCompleted
  )
  const installStatus = useSelector(updateStore, (state) => state.context.installStatus)
  const releaseUrl = useSelector(updateStore, (state) => state.context.releaseUrl)
  const updateSource = useSelector(updateStore, (state) => state.context.updateSource)
  const supportsFlexibleUpdate = useSelector(
    updateStore,
    (state) => state.context.supportsFlexibleUpdate
  )
  const supportsImmediateUpdate = useSelector(
    updateStore,
    (state) => state.context.supportsImmediateUpdate
  )

  const handleUpdate = useCallback(async () => {
    try {
      await performUpdateAction({
        installStatus,
        supportsFlexibleUpdate,
        supportsImmediateUpdate,
        releaseUrl,
        updateSource,
      })
    } catch (error) {
      console.error("Failed to handle update action:", error)
      notificationStore.trigger.addNotification({
        message:
          updateSource === "github"
            ? "Failed to open the release page. Please try again."
            : "Failed to start the Play Store update. Please try again.",
        notificationType: "error",
      })
    }
  }, [
    installStatus,
    releaseUrl,
    supportsFlexibleUpdate,
    supportsImmediateUpdate,
    updateSource,
  ])

  const handleDismiss = useCallback(async () => {
    await dismissUpdateBanner(latestVersion, updateStore)
  }, [latestVersion, updateStore])

  const checkForUpdates = useCallback(async () => {
    await runManualUpdateCheck(updateStore)
  }, [updateStore])

  return {
    updateAvailable,
    latestVersion,
    showBanner,
    updateCheckCompleted,
    isUpdateReadyToInstall: installStatus === "downloaded",
    handleUpdate,
    handleDismiss,
    checkForUpdates,
  }
}
