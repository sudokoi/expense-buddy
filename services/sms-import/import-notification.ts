/**
 * Import Notification Service
 *
 * Displays local push notifications when SMS transactions are detected
 * and added to the review queue. Tapping the notification opens the app
 * to the dashboard where the review queue is visible.
 */

import * as Notifications from "expo-notifications"

/**
 * Show a local notification for a newly detected SMS transaction.
 * Silently skips if notification permissions are not granted.
 */
export async function showImportNotification(
  merchant: string,
  amount: number,
  currency: string
): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== "granted") {
      return
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "New Transaction Detected",
        body: `${currency} ${amount} at ${merchant}`,
        data: { screen: "review-queue" },
      },
      trigger: null,
    })
  } catch (error) {
    // Never crash the app due to notification failures
    console.warn("Failed to show import notification:", error)
  }
}
