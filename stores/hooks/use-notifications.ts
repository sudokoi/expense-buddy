import { useCallback } from "react"
import { useSelector } from "@xstate/store-react"
import { useStoreContext } from "../store-provider"
import { NotificationType } from "../notification-store"

export const useNotifications = () => {
  const { notificationStore } = useStoreContext()

  const notifications = useSelector(
    notificationStore,
    (state) => state.context.notifications
  )

  const addNotification = useCallback(
    (message: string, notificationType?: NotificationType, duration?: number) => {
      const eventPayload: {
        message: string
        notificationType?: NotificationType
        duration?: number
      } = { message }
      if (notificationType !== undefined) {
        eventPayload.notificationType = notificationType
      }
      if (duration !== undefined) {
        eventPayload.duration = duration
      }
      notificationStore.trigger.addNotification(eventPayload)
    },
    [notificationStore]
  )

  const removeNotification = useCallback(
    (id: string) => notificationStore.trigger.removeNotification({ id }),
    [notificationStore]
  )

  return {
    notifications,
    addNotification,
    removeNotification,
  }
}
