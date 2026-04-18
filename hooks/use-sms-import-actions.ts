import { useCallback, useState } from "react"
import { Platform } from "react-native"
import { Href, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { useNotifications, useSettings, useSmsImportReview } from "../stores/hooks"
import {
  getSmsPermissionStatus,
  requestSmsPermission,
  type SmsImportPermissionStatus,
} from "../services/sms-import/android-sms-module"
import { scanSmsImportReviewQueue } from "../services/sms-import/bootstrap"

type ScanSmsImportsResult = {
  createdCount: number
  pendingCount: number
  permissionStatus: SmsImportPermissionStatus
}

export function useSmsImportActions() {
  const router = useRouter()
  const { t } = useTranslation()
  const { addNotification } = useNotifications()
  const { settings } = useSettings()
  const { items, pendingItems, lastScanCursor, bootstrapCompletedAt, upsertReviewItems } =
    useSmsImportReview()
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
      let permissionStatus = await getSmsPermissionStatus()

      if (permissionStatus !== "granted") {
        permissionStatus = await requestSmsPermission()
      }

      if (permissionStatus !== "granted") {
        addNotification(t("settings.smsImport.notifications.permissionRequired"), "info")
        return {
          createdCount: 0,
          pendingCount: pendingItems.length,
          permissionStatus,
        }
      }

      const result = await scanSmsImportReviewQueue({
        existingItems: items,
        lastScanCursor,
        bootstrapCompletedAt,
        useMlOnlyForSmsImports: settings.useMlOnlyForSmsImports,
      })

      upsertReviewItems(result.createdItems, {
        lastScanCursor: result.nextCursor,
        bootstrapCompletedAt: result.bootstrapCompletedAt,
      })

      const pendingCount = pendingItems.length + result.createdItems.length

      if (result.createdItems.length > 0) {
        addNotification(
          result.createdItems.length === 1
            ? t("settings.smsImport.notifications.readyOne")
            : t("settings.smsImport.notifications.readyMany", {
                count: result.createdItems.length,
              }),
          "success"
        )
      } else {
        addNotification(t("settings.smsImport.notifications.emptyScan"), "info")
      }

      return {
        createdCount: result.createdItems.length,
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
  }, [
    addNotification,
    bootstrapCompletedAt,
    items,
    lastScanCursor,
    pendingItems.length,
    settings.useMlOnlyForSmsImports,
    t,
    upsertReviewItems,
  ])

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
