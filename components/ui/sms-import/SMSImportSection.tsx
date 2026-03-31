/**
 * SMS Import Settings Section
 *
 * Settings UI for SMS expense import feature
 */

import { useState, useEffect, useCallback } from "react"
import { YStack, XStack, Text, Switch, Separator } from "tamagui"
import { Alert } from "react-native"
import { Brain, MessageSquare } from "@tamagui/lucide-icons"
import { useTranslation } from "react-i18next"
import {
  checkSMSPermission,
  requestSMSPermission,
} from "../../../services/sms-import/permissions"
import { smsListener } from "../../../services/sms-import/sms-listener"
import { mlParser } from "../../../services/sms-import/ml/ml-parser"
import { duplicateDetector } from "../../../services/sms-import/duplicate-detector"
import { merchantLearningEngine } from "../../../services/sms-import/learning-engine"
import { useSettings } from "../../../stores/hooks"

export function SMSImportSection() {
  const { t } = useTranslation()
  const { settings, updateSMSImportSettings } = useSettings()
  const [hasPermission, setHasPermission] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const smsSettings = settings.smsImportSettings

  const loadPermissionStatus = useCallback(async () => {
    try {
      setHasPermission(await checkSMSPermission())
    } catch (error) {
      console.error("Failed to load SMS permission status:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPermissionStatus()
  }, [loadPermissionStatus])

  const handleToggleEnabled = useCallback(
    async (enabled: boolean) => {
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

      updateSMSImportSettings({ enabled })

      if (enabled) {
        try {
          await duplicateDetector.initialize()
          await merchantLearningEngine.initialize()
          await mlParser.initialize()
          await smsListener.initialize()
        } catch (error) {
          console.error("Failed to start SMS listener:", error)
        }
      } else {
        await smsListener.dispose()
      }
    },
    [hasPermission, t, updateSMSImportSettings]
  )

  const handleToggleSyncLearnings = useCallback(
    (syncLearnings: boolean) => {
      updateSMSImportSettings({ syncLearnings })
    },
    [updateSMSImportSettings]
  )

  if (isLoading) {
    return null
  }

  const getStatusText = () => {
    if (!smsSettings.enabled) return t("smsImport.status.disabled")
    if (!hasPermission) return t("smsImport.status.permissionNeeded")
    return t("smsImport.status.active")
  }

  return (
    <YStack gap="$4">
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

      <Separator />

      <XStack justify="space-between" items="center">
        <YStack flex={1} pr="$3">
          <Text color="$color" fontSize="$4">
            {t("smsImport.enable")}
          </Text>
          <Text fontSize="$2" color="$colorTransparent">
            {getStatusText()}
          </Text>
        </YStack>
        <Switch
          checked={smsSettings.enabled}
          onCheckedChange={handleToggleEnabled}
          bg={smsSettings.enabled ? "$green8" : undefined}
        >
          <Switch.Thumb />
        </Switch>
      </XStack>

      <YStack bg={hasPermission ? "$green2" : "$red2"} p="$3" rounded="$3" gap="$1">
        <Text
          fontSize="$3"
          color={hasPermission ? "$green10" : "$red10"}
          fontWeight="600"
        >
          {hasPermission
            ? t("smsImport.permissionGranted")
            : t("smsImport.permissionDenied")}
        </Text>
        <Text fontSize="$2" color="$colorTransparent">
          {t("smsImport.reviewFirstHelp")}
        </Text>
      </YStack>

      <YStack bg="$backgroundFocus" p="$3" rounded="$3" gap="$3">
        <XStack items="center" gap="$2">
          <Brain size={18} color="$color" />
          <Text color="$color" fontSize="$4" fontWeight="600">
            {t("smsImport.smartCategorisation.title")}
          </Text>
        </XStack>

        <Text fontSize="$2" color="$colorTransparent">
          {t("smsImport.smartCategorisation.description")}
        </Text>

        <XStack justify="space-between" items="center">
          <YStack flex={1} pr="$3">
            <Text color="$color" fontSize="$4">
              {t("smsImport.syncLearnings")}
            </Text>
            <Text fontSize="$2" color="$colorTransparent">
              {t("smsImport.syncLearningsHelp")}
            </Text>
          </YStack>
          <Switch
            checked={smsSettings.syncLearnings}
            onCheckedChange={handleToggleSyncLearnings}
            disabled={!smsSettings.enabled}
          >
            <Switch.Thumb />
          </Switch>
        </XStack>

        <Text fontSize="$2" color="$colorTransparent">
          {t("smsImport.modelUpdateNote")}
        </Text>
      </YStack>

      <Text fontSize="$2" color="$colorTransparent">
        {t("smsImport.privacyNote")}
      </Text>
    </YStack>
  )
}
