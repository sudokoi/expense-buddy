import { createStore } from "@xstate/store"

export type NotificationType = "success" | "error" | "info" | "warning"

export interface Notification {
  id: string
  message: string
  type: NotificationType
  duration: number
}

export const notificationStore = createStore({
  context: {
    notifications: [] as Notification[],
  },

  on: {
    addNotification: (
      context,
      event: { message: string; type?: NotificationType; duration?: number },
      enqueue
    ) => {
      const id = Date.now().toString() + Math.random().toString(36)
      const notification: Notification = {
        id,
        message: event.message,
        type: event.type ?? "info",
        duration: event.duration ?? 5000,
      }

      // Keep max 3 notifications
      const newNotifications = [...context.notifications, notification].slice(-3)

      // Schedule auto-removal
      enqueue.effect(() => {
        setTimeout(() => {
          notificationStore.trigger.removeNotification({ id })
        }, notification.duration)
      })

      return { ...context, notifications: newNotifications }
    },

    removeNotification: (context, event: { id: string }) => ({
      ...context,
      notifications: context.notifications.filter((n) => n.id !== event.id),
    }),
  },
})

export type NotificationStore = typeof notificationStore
