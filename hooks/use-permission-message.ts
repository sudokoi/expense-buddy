/**
 * Hook for translating SMS permission status into user-friendly messages
 */

import { useCallback } from "react"
import { useTranslation } from "react-i18next"

/** Valid permission status keys */
type PermissionStatus = "granted" | "denied" | "blocked" | "unavailable" | "unsupported"

const PERMISSION_STATUS_KEYS: Record<PermissionStatus, string> = {
  granted: "smsImport.permissionMessages.granted",
  denied: "smsImport.permissionMessages.denied",
  blocked: "smsImport.permissionMessages.blocked",
  unavailable: "smsImport.permissionMessages.unavailable",
  unsupported: "smsImport.permissionMessages.unsupported",
}

/**
 * Returns a function that resolves a permission status to a translated message
 */
export function usePermissionMessage() {
  const { t } = useTranslation()

  const getPermissionMessage = useCallback(
    (status: string): string => {
      const key = PERMISSION_STATUS_KEYS[status as PermissionStatus]
      return key ? t(key) : t("smsImport.permissionMessages.unknown")
    },
    [t]
  )

  return { getPermissionMessage }
}
