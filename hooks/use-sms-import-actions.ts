import { useCallback, useState } from "react"
import { Platform } from "react-native"
import { Href, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { useNotifications, useSettings, useSmsImportReview } from "../stores/hooks"
import {
  syncInboxAsync,
  getBackgroundSmsPermissionStatus,
  requestBackgroundSmsPermission,
  type BackgroundSmsPermissionStatus,
} from "../services/background-sms/android-background-sms-module"

type ScanSmsImportsResult = {
  createdCount: number
  pendingCount: number
  permissionStatus: BackgroundSmsPermissionStatus
}

export function useSmsImportActions() {
  const router = useRouter()
  const { t } = useTranslation()
  const { addNotification } = useNotifications()
  const { settings } = useSettings()
  const { pendingItems } = useSmsImportReview()
  const [isScanningSmsImports, setIsScanningSmsImports] = useState(false)

  const openSmsImportReview = useCallback(() => {
    router.push("/sms/review" as Href)
  }, [router])

  const scanSmsImports = useCallback(async (): Promise<ScanSmsImportsResult> => {
    if (Platform.OS !== "android") {
      addNotification(t("settings.smsImport.notifications.androidOnly"), "info")
      return {
        createdCount: 0,
        pendingCount: pendingItems.length,
        permissionStatus: "unavailable",
      }
    }

    setIsScanningSmsImports(true)

    try {
      let permissionStatus = await getBackgroundSmsPermissionStatus()

      if (permissionStatus !== "granted") {
        permissionStatus = await requestBackgroundSmsPermission()
      }

      if (permissionStatus !== "granted") {
        addNotification(t("settings.smsImport.notifications.permissionRequired"), "info")
        return {
          createdCount: 0,
          pendingCount: pendingItems.length,
          permissionStatus,
        }
      }

      const scannedCount = await syncInboxAsync(settings.useMlOnlyForSmsImports ?? false)

      const pendingCount = pendingItems.length + scannedCount

      if (scannedCount > 0) {
        addNotification(
          scannedCount === 1
            ? t("settings.smsImport.notifications.readyOne")
            : t("settings.smsImport.notifications.readyMany", {
                count: scannedCount,
              }),
          "success"
        )
      } else {
        addNotification(t("settings.smsImport.notifications.emptyScan"), "info")
      }

      return {
        createdCount: scannedCount,
        pendingCount,
        permissionStatus,
      }
    } catch (error) {
      addNotification(error instanceof Error ? error.message : String(error), "error")
      return {
        createdCount: 0,
        pendingCount: pendingItems.length,
        permissionStatus: "unavailable",
      }
    } finally {
      setIsScanningSmsImports(false)
    }
  }, [addNotification, pendingItems.length, settings.useMlOnlyForSmsImports, t])

  const startSmsImportFromAdd = useCallback(async () => {
    if (pendingItems.length > 0) {
      openSmsImportReview()
      return
    }

    const result = await scanSmsImports()
    if (result.pendingCount > 0) {
      openSmsImportReview()
    }
  }, [openSmsImportReview, pendingItems.length, scanSmsImports])

  return {
    isScanningSmsImports,
    openSmsImportReview,
    scanSmsImports,
    startSmsImportFromAdd,
  }
}
