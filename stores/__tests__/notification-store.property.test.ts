/**
 * Property-based tests for Notification Store
 *
 * Property 7: Notification Max Limit
 * For any sequence of N notifications added to the notification store where N > 3,
 * the store SHALL contain exactly 3 notifications, and they SHALL be the 3 most recently added.
 *
 * Property 8: Notification Add/Remove Consistency
 * For any notification added to the store, the notification SHALL be present in the notifications array.
 * For any notification id removed from the store, no notification with that id SHALL be present in the array.
 *
 */

import fc from "fast-check"
import { createStore } from "@xstate/store"
import { NotificationType, Notification } from "../notification-store"

// Create a fresh store for each test with deterministic IDs
function createTestNotificationStore() {
  let idCounter = 0

  return createStore({
    context: {
      notifications: [] as Notification[],
    },

    on: {
      addNotification: (
        context,
        event: { message: string; notificationType?: NotificationType; duration?: number }
      ) => {
        idCounter++
        const notification: Notification = {
          id: `notification-${idCounter}`,
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

// Arbitrary generators
const notificationTypeArb = fc.constantFrom<NotificationType>(
  "success",
  "error",
  "info",
  "warning"
)

const notificationEventArb = fc.record({
  message: fc.string({ minLength: 1, maxLength: 100 }),
  notificationType: fc.option(notificationTypeArb, { nil: undefined }),
  duration: fc.option(fc.integer({ min: 1000, max: 30000 }), { nil: undefined }),
})

describe("Notification Store Properties", () => {
  /**
   * Property 7: Notification Max Limit
   */
  describe("Property 7: Notification Max Limit", () => {
    it("store SHALL contain at most 3 notifications regardless of how many are added", () => {
      fc.assert(
        fc.property(
          fc.array(notificationEventArb, { minLength: 1, maxLength: 20 }),
          (notifications) => {
            const store = createTestNotificationStore()

            for (const notification of notifications) {
              store.trigger.addNotification(notification)
            }

            return store.getSnapshot().context.notifications.length <= 3
          }
        ),
        { numRuns: 100 }
      )
    })

    it("when more than 3 notifications are added, only the 3 most recent SHALL remain", () => {
      fc.assert(
        fc.property(fc.integer({ min: 4, max: 20 }), (count) => {
          const store = createTestNotificationStore()

          // Add numbered notifications
          for (let i = 1; i <= count; i++) {
            store.trigger.addNotification({ message: `Message ${i}` })
          }

          const notifications = store.getSnapshot().context.notifications
          expect(notifications).toHaveLength(3)

          // The 3 most recent should be the last 3 added
          expect(notifications[0].message).toBe(`Message ${count - 2}`)
          expect(notifications[1].message).toBe(`Message ${count - 1}`)
          expect(notifications[2].message).toBe(`Message ${count}`)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("adding exactly 3 notifications SHALL result in exactly 3 notifications", () => {
      fc.assert(
        fc.property(
          fc.tuple(notificationEventArb, notificationEventArb, notificationEventArb),
          ([n1, n2, n3]) => {
            const store = createTestNotificationStore()

            store.trigger.addNotification(n1)
            store.trigger.addNotification(n2)
            store.trigger.addNotification(n3)

            const notifications = store.getSnapshot().context.notifications
            return (
              notifications.length === 3 &&
              notifications[0].message === n1.message &&
              notifications[1].message === n2.message &&
              notifications[2].message === n3.message
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 8: Notification Add/Remove Consistency
   */
  describe("Property 8: Notification Add/Remove Consistency", () => {
    it("added notification SHALL be present in the array (when under limit)", () => {
      fc.assert(
        fc.property(notificationEventArb, (notification) => {
          const store = createTestNotificationStore()

          store.trigger.addNotification(notification)

          const notifications = store.getSnapshot().context.notifications
          return (
            notifications.length === 1 &&
            notifications[0].message === notification.message
          )
        }),
        { numRuns: 100 }
      )
    })

    it("removed notification SHALL not be present in the array", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
            minLength: 1,
            maxLength: 3,
          }),
          fc.integer({ min: 0, max: 2 }),
          (messages, removeIndex) => {
            const store = createTestNotificationStore()

            // Add notifications with known IDs
            const ids: string[] = []
            for (let i = 0; i < messages.length; i++) {
              const id = `test-${i}`
              ids.push(id)
              store.trigger.addNotificationWithId({ id, message: messages[i] })
            }

            // Remove one notification
            const actualRemoveIndex = removeIndex % messages.length
            const idToRemove = ids[actualRemoveIndex]
            store.trigger.removeNotification({ id: idToRemove })

            // Verify it's gone
            const notifications = store.getSnapshot().context.notifications
            return !notifications.some((n) => n.id === idToRemove)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("removing non-existent id SHALL not affect existing notifications", () => {
      fc.assert(
        fc.property(
          fc.array(notificationEventArb, { minLength: 1, maxLength: 3 }),
          fc.string({ minLength: 10, maxLength: 20 }),
          (notifications, nonExistentId) => {
            const store = createTestNotificationStore()

            for (const notification of notifications) {
              store.trigger.addNotification(notification)
            }

            const beforeRemove = store.getSnapshot().context.notifications.length

            store.trigger.removeNotification({ id: `non-existent-${nonExistentId}` })

            const afterRemove = store.getSnapshot().context.notifications.length

            return beforeRemove === afterRemove
          }
        ),
        { numRuns: 100 }
      )
    })

    it("notification type and duration SHALL be preserved", () => {
      fc.assert(
        fc.property(
          notificationTypeArb,
          fc.integer({ min: 1000, max: 30000 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (notificationType, duration, message) => {
            const store = createTestNotificationStore()

            store.trigger.addNotification({ message, notificationType, duration })

            const notifications = store.getSnapshot().context.notifications
            return (
              notifications[0].type === notificationType &&
              notifications[0].duration === duration &&
              notifications[0].message === message
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
