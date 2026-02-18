/**
 * SMS Import Settings Section
 *
 * Settings UI for SMS expense import feature
 */

import { useState, useEffect, useCallback } from "react"
import { YStack, XStack, Text, Switch, Separator } from "tamagui"
import { Alert } from "react-native"
import { MessageSquare } from "@tamagui/lucide-icons"
import { useTranslation } from "react-i18next"
import { SMSImportSettings } from "../../../types/sms-import"
import {
  loadSMSImportSettings,
  saveSMSImportSettings,
} from "../../../services/sms-import/settings"
import {
  checkSMSPermission,
  requestSMSPermission,
} from "../../../services/sms-import/permissions"

export function SMSImportSection() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<SMSImportSettings | null>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadSettings = useCallback(async () => {
    try {
      const [smsSettings, permissionStatus] = await Promise.all([
        loadSMSImportSettings(),
        checkSMSPermission(),
      ])
      setSettings(smsSettings)
      setHasPermission(permissionStatus)
    } catch (error) {
      console.error("Failed to load SMS import settings:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const handleToggleEnabled = useCallback(
    async (enabled: boolean) => {
      if (!settings) return

      if (enabled && !hasPermission) {
        const granted = await requestSMSPermission({
          title: t("smsImport.permissionDialog.title"),
          message: t("smsImport.permissionDialog.message"),
          buttonNeutral: t("smsImport.permissionDialog.buttonNeutral"),
          buttonNegative: t("common.cancel"),
          buttonPositive: t("smsImport.permissionDialog.buttonPositive"),
        })
        if (!granted) {
          Alert.alert(
            t("smsImport.permissionAlert.title"),
            t("smsImport.permissionAlert.message"),
            [{ text: t("common.done") }]
          )
          return
        }
        setHasPermission(true)
      }

      const newSettings = { ...settings, enabled }
      setSettings(newSettings)
      await saveSMSImportSettings(newSettings)
    },
    [settings, hasPermission, t]
  )

  const handleToggleScanOnLaunch = useCallback(
    async (scanOnLaunch: boolean) => {
      if (!settings) return

      const newSettings = { ...settings, scanOnLaunch }
      setSettings(newSettings)
      await saveSMSImportSettings(newSettings)
    },
    [settings]
  )

  if (isLoading || !settings) {
    return null
  }

  const getStatusText = () => {
    if (!settings.enabled) return t("smsImport.status.disabled")
    if (!hasPermission) return t("smsImport.status.permissionNeeded")
    return t("smsImport.status.active")
  }

  return (
    <YStack gap="$3">
      <XStack items="center" gap="$2">
        <MessageSquare size={20} color="$color" />
        <Text fontSize="$5" fontWeight="600" color="$color">
          {t("smsImport.title")}{" "}
          <Text fontSize="$3" color="#f97316" fontWeight="600">
            (Beta)
          </Text>
        </Text>
      </XStack>

      <Text fontSize="$3" color="$colorTransparent">
        {t("smsImport.description")}
      </Text>

      <Text fontSize="$2" color="#f97316" fontStyle="italic">
        {t("smsImport.betaWarning")}
      </Text>

      <Separator my="$2" />

      {/* Enable/Disable Toggle */}
      <XStack justify="space-between" items="center">
        <YStack>
          <Text color="$color" fontSize="$4">
            {t("smsImport.enable")}
          </Text>
          <Text fontSize="$2" color="$colorTransparent">
            {getStatusText()}
          </Text>
        </YStack>
        <Switch
          checked={settings.enabled}
          onCheckedChange={handleToggleEnabled}
          bg={settings.enabled ? "$green8" : undefined}
        >
          <Switch.Thumb />
        </Switch>
      </XStack>

      {/* Scan on Launch Toggle */}
      {settings.enabled && (
        <>
          <XStack justify="space-between" items="center" mt="$2">
            <YStack>
              <Text color="$color" fontSize="$4">
                {t("smsImport.scanOnLaunch")}
              </Text>
              <Text fontSize="$2" color="$colorTransparent">
                {t("smsImport.scanOnLaunchHelp")}
              </Text>
            </YStack>
            <Switch
              checked={settings.scanOnLaunch}
              onCheckedChange={handleToggleScanOnLaunch}
            >
              <Switch.Thumb />
            </Switch>
          </XStack>

          {/* Permission Status */}
          <YStack bg={hasPermission ? "$green2" : "$red2"} p="$3" rounded="$2" mt="$2">
            <Text fontSize="$3" color={hasPermission ? "$green10" : "$red10"}>
              {hasPermission
                ? t("smsImport.permissionGranted")
                : t("smsImport.permissionDenied")}
            </Text>
          </YStack>
        </>
      )}

      {/* Info Note */}
      <Text fontSize="$2" color="$colorTransparent" mt="$2">
        {t("smsImport.infoNote")}
      </Text>
    </YStack>
  )
}
