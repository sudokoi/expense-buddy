/**
 * SMS Import Integration Example
 *
 * This file demonstrates how to integrate SMS import into the main app.
 * Copy relevant parts to your app initialization code.
 */

import { useEffect } from "react"
import { AppState, AppStateStatus } from "react-native"
import {
  initializeSMSImport,
  disposeSMSImport,
  requestSMSPermission,
  isSMSImportEnabled,
} from "./services/sms-import"

/**
 * Example: Initialize SMS import on app startup
 * Add this to your root App component
 */
export function useSMSImport() {
  useEffect(() => {
    let isMounted = true

    const init = async () => {
      // Check if SMS import is enabled
      const enabled = await isSMSImportEnabled()
      if (!enabled) return

      // Initialize SMS import
      await initializeSMSImport()
    }

    init()

    // Handle app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "background") {
        // Optionally dispose when app goes to background
        // to save memory
        // disposeSMSImport()
      }
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange)

    return () => {
      isMounted = false
      subscription.remove()
      disposeSMSImport()
    }
  }, [])
}

/**
 * Example: Request SMS permission from user
 * Call this when user enables SMS import in settings
 */
export async function enableSMSImport(): Promise<boolean> {
  try {
    const granted = await requestSMSPermission()

    if (granted) {
      // Initialize SMS import immediately
      const success = await initializeSMSImport()
      return success
    }

    return false
  } catch (error) {
    console.error("Failed to enable SMS import:", error)
    return false
  }
}

/**
 * Example: Manual SMS testing
 * Useful for development and debugging
 */
export async function testSMSParsing() {
  const { smsListener } = await import("./services/sms-import")

  // Test messages
  const testMessages = [
    "Rs.1500 debited from a/c **1234 on 15-02-2024 at Swiggy. Avl Bal: Rs.25430",
    "Thank you for using ICICI Credit Card ending 5678 for INR 2499 at AMAZON",
    "This is not a transaction message",
    "Rs.999 credited to your account on 10-02-2024 via UPI Ref: 123456789012",
  ]

  for (const message of testMessages) {
    console.log("\n--- Testing ---")
    console.log("Message:", message)
    await smsListener.handleIncomingMessage(message)
  }
}

/**
 * Example: Handle SMS import in settings screen
 */
export function SMSImportToggleExample() {
  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      // Request permission and initialize
      const success = await enableSMSImport()
      if (!success) {
        // Show error to user
        alert("Failed to enable SMS import. Please check permissions.")
      }
    } else {
      // Disable SMS import
      const { saveSMSImportSettings } = await import("./services/sms-import")
      await saveSMSImportSettings({
        enabled: false,
        scanOnLaunch: false,
        reviewRetentionDays: 30,
      })
      await disposeSMSImport()
    }
  }

  return {
    handleToggle,
  }
}

/**
 * Example: Integration with expense store
 * When user confirms an imported expense
 */
export async function confirmImportedExpense(reviewItemId: string, expenseData: any) {
  const { reviewQueueStore } = await import("./stores/review-queue-store")

  reviewQueueStore.trigger.confirmItem({
    itemId: reviewItemId,
    expenseData,
  })
}
