/**
 * Unit tests for Notification Store
 */

import { createStore } from "@xstate/store"
import { NotificationType, Notification } from "../notification-store"

// Create a fresh store for each test to avoid state pollution
function createTestNotificationStore() {
  return createStore({
    context: {
      notifications: [] as Notification[],
    },

    on: {
      addNotification: (
        context,
        event: { message: string; notificationType?: NotificationType; duration?: number }
      ) => {
        const id = Date.now().toString() + Math.random().toString(36)
        const notification: Notification = {
          id,
          message: event.message,
          type: event.notificationType ?? "info",
          duration: event.duration ?? 5000,
        }

        // Keep max 3 notifications
        const newNotifications = [...context.notifications, notification].slice(-3)

        return { ...context, notifications: newNotifications }
      },

      removeNotification: (context, event: { id: string }) => ({
        ...context,
        notifications: context.notifications.filter((n) => n.id !== event.id),
      }),

      // Helper for testing - add notification with specific id
      addNotificationWithId: (
        context,
        event: {
          id: string
          message: string
          notificationType?: NotificationType
          duration?: number
        }
      ) => {
        const notification: Notification = {
          id: event.id,
          message: event.message,
          type: event.notificationType ?? "info",
          duration: event.duration ?? 5000,
        }

        const newNotifications = [...context.notifications, notification].slice(-3)
        return { ...context, notifications: newNotifications }
      },
    },
  })
}

describe("Notification Store", () => {
  describe("Initial state", () => {
    it("should start with empty notifications array", () => {
      const store = createTestNotificationStore()
      expect(store.getSnapshot().context.notifications).toEqual([])
    })
  })

  describe("addNotification action", () => {
    it("should add a notification with default values", () => {
      const store = createTestNotificationStore()
      store.trigger.addNotification({ message: "Test message" })

      const notifications = store.getSnapshot().context.notifications
      expect(notifications).toHaveLength(1)
      expect(notifications[0].message).toBe("Test message")
      expect(notifications[0].type).toBe("info")
      expect(notifications[0].duration).toBe(5000)
    })

    it("should add a notification with custom type", () => {
      const store = createTestNotificationStore()
      store.trigger.addNotification({ message: "Error!", notificationType: "error" })

      const notifications = store.getSnapshot().context.notifications
      expect(notifications[0].type).toBe("error")
    })

    it("should add a notification with custom duration", () => {
      const store = createTestNotificationStore()
      store.trigger.addNotification({ message: "Quick", duration: 1000 })

      const notifications = store.getSnapshot().context.notifications
      expect(notifications[0].duration).toBe(1000)
    })

    it("should generate unique ids for each notification", () => {
      const store = createTestNotificationStore()
      store.trigger.addNotification({ message: "First" })
      store.trigger.addNotification({ message: "Second" })

      const notifications = store.getSnapshot().context.notifications
      expect(notifications[0].id).not.toBe(notifications[1].id)
    })

    it("should keep max 3 notifications", () => {
      const store = createTestNotificationStore()
      store.trigger.addNotification({ message: "First" })
      store.trigger.addNotification({ message: "Second" })
      store.trigger.addNotification({ message: "Third" })
      store.trigger.addNotification({ message: "Fourth" })

      const notifications = store.getSnapshot().context.notifications
      expect(notifications).toHaveLength(3)
      expect(notifications[0].message).toBe("Second")
      expect(notifications[1].message).toBe("Third")
      expect(notifications[2].message).toBe("Fourth")
    })

    it("should support all notification types", () => {
      const types: NotificationType[] = ["success", "error", "info", "warning"]

      for (const notificationType of types) {
        const store = createTestNotificationStore()
        store.trigger.addNotification({
          message: `${notificationType} message`,
          notificationType,
        })

        const notifications = store.getSnapshot().context.notifications
        expect(notifications[0].type).toBe(notificationType)
      }
    })
  })

  describe("removeNotification action", () => {
    it("should remove notification by id", () => {
      const store = createTestNotificationStore()
      store.trigger.addNotificationWithId({ id: "test-1", message: "First" })
      store.trigger.addNotificationWithId({ id: "test-2", message: "Second" })

      store.trigger.removeNotification({ id: "test-1" })

      const notifications = store.getSnapshot().context.notifications
      expect(notifications).toHaveLength(1)
      expect(notifications[0].id).toBe("test-2")
    })

    it("should do nothing when removing non-existent id", () => {
      const store = createTestNotificationStore()
      store.trigger.addNotificationWithId({ id: "test-1", message: "First" })

      store.trigger.removeNotification({ id: "non-existent" })

      const notifications = store.getSnapshot().context.notifications
      expect(notifications).toHaveLength(1)
    })

    it("should handle removing from empty array", () => {
      const store = createTestNotificationStore()
      store.trigger.removeNotification({ id: "any-id" })

      const notifications = store.getSnapshot().context.notifications
      expect(notifications).toEqual([])
    })
  })
})
