import { PermissionsAndroid, Platform } from "react-native"

export interface BackgroundSmsPermissionResult {
  granted: boolean
  receiveSmsGranted: boolean
  notificationsGranted: boolean
}

export async function requestBackgroundSmsPermissions(): Promise<BackgroundSmsPermissionResult> {
  if (Platform.OS !== "android") {
    return {
      granted: false,
      receiveSmsGranted: false,
      notificationsGranted: false,
    }
  }

  let receiveSmsGranted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
  )

  if (!receiveSmsGranted) {
    const receiveResult = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
    )
    receiveSmsGranted = receiveResult === PermissionsAndroid.RESULTS.GRANTED
  }

  let notificationsGranted = true
  if (Platform.Version >= 33) {
    notificationsGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    )

    if (!notificationsGranted) {
      const notificationResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      )
      notificationsGranted = notificationResult === PermissionsAndroid.RESULTS.GRANTED
    }
  }

  return {
    granted: receiveSmsGranted && notificationsGranted,
    receiveSmsGranted,
    notificationsGranted,
  }
}
