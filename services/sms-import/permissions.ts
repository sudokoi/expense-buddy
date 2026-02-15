/**
 * SMS Permission Utilities
 *
 * Handles Android SMS permissions for the import feature
 */

import { Platform, PermissionsAndroid } from "react-native"

/**
 * Check if device supports SMS import (Android only)
 */
export function isSMSSupported(): boolean {
  return Platform.OS === "android"
}

/**
 * Check current SMS permission status
 */
export async function checkSMSPermission(): Promise<boolean> {
  if (!isSMSSupported()) {
    return false
  }

  try {
    const status = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS)
    return status
  } catch (error) {
    console.error("Failed to check SMS permission:", error)
    return false
  }
}

/**
 * Request SMS permission from user
 */
export async function requestSMSPermission(): Promise<boolean> {
  if (!isSMSSupported()) {
    return false
  }

  try {
    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: "SMS Permission",
        message:
          "Expense Buddy needs access to SMS to automatically detect expenses from bank messages.",
        buttonNeutral: "Ask Me Later",
        buttonNegative: "Cancel",
        buttonPositive: "OK",
      }
    )
    return status === PermissionsAndroid.RESULTS.GRANTED
  } catch (error) {
    console.error("Failed to request SMS permission:", error)
    return false
  }
}

/**
 * Check if SMS permission can be requested (not permanently denied)
 */
export async function canRequestSMSPermission(): Promise<boolean> {
  if (!isSMSSupported()) {
    return false
  }

  try {
    const status = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS)
    // If already granted, can't request again (but that's ok)
    // If never asked before, we can request
    return true
  } catch (error) {
    console.error("Failed to check SMS permission status:", error)
    return false
  }
}

/**
 * Get detailed permission status with reason
 */
export async function getSMSPermissionDetails(): Promise<{
  granted: boolean
  canAsk: boolean
  status: string
}> {
  if (!isSMSSupported()) {
    return { granted: false, canAsk: false, status: "unsupported" }
  }

  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS
    )
    return {
      granted,
      canAsk: !granted,
      status: granted ? "granted" : "denied",
    }
  } catch (error) {
    console.error("Failed to get SMS permission details:", error)
    return { granted: false, canAsk: false, status: "error" }
  }
}

/**
 * Permission status messages for UI
 */
export const PERMISSION_MESSAGES = {
  granted:
    "SMS access granted. Expenses will be automatically imported from bank SMS messages.",
  denied:
    "SMS permission denied. You can enable it in Settings > Apps > Expense Buddy > Permissions.",
  blocked:
    "SMS permission permanently denied. Please enable it in system settings to use auto-import.",
  unavailable: "SMS import is not available on this device.",
  unsupported: "SMS import is only available on Android devices.",
}

/**
 * Get user-friendly message for permission status
 */
export function getPermissionMessage(status: string): string {
  return (
    PERMISSION_MESSAGES[status as keyof typeof PERMISSION_MESSAGES] ||
    "Unknown permission status."
  )
}
