/**
 * SMS Permission Utilities
 *
 * Handles Android SMS permissions for the import feature
 */

import { Platform, PermissionsAndroid } from "react-native"

/** Translated strings for the Android permission request dialog */
export interface PermissionDialogStrings {
  title: string
  message: string
  buttonNeutral: string
  buttonNegative: string
  buttonPositive: string
}

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
 * Request SMS permission from user.
 * Accepts pre-translated dialog strings so the service stays i18n-agnostic.
 */
export async function requestSMSPermission(
  dialogStrings?: PermissionDialogStrings
): Promise<boolean> {
  const strings = dialogStrings || {
    title: "SMS Permission",
    message:
      "Expense Buddy needs access to SMS to automatically detect expenses from bank messages.",
    buttonNeutral: "Ask Me Later",
    buttonNegative: "Cancel",
    buttonPositive: "OK",
  }
  if (!isSMSSupported()) {
    return false
  }

  try {
    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: strings.title,
        message: strings.message,
        buttonNeutral: strings.buttonNeutral,
        buttonNegative: strings.buttonNegative,
        buttonPositive: strings.buttonPositive,
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
    await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS)
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
