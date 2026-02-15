/**
 * SMS Import Settings Section
 *
 * Settings UI for SMS expense import feature
 */

import { useState, useEffect } from "react"
import { YStack, XStack, Text, Switch, Button, Separator } from "tamagui"
import { Alert } from "react-native"
import { MessageSquare } from "@tamagui/lucide-icons"
import { useTranslation } from "react-i18next"
import { SMSImportSettings } from "../../types/sms-import"
import {
  loadSMSImportSettings,
  saveSMSImportSettings,
} from "../../services/sms-import/settings"
import {
  checkSMSPermission,
  requestSMSPermission,
  getPermissionMessage,
} from "../../services/sms-import/permissions"

export function SMSImportSection() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<SMSImportSettings | null>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
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
  }

  const handleToggleEnabled = async (enabled: boolean) => {
    if (!settings) return

    if (enabled && !hasPermission) {
      // Request permission
      const granted = await requestSMSPermission()
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "SMS permission is required to automatically import expenses from bank messages. Please enable it in Settings > Apps > Expense Buddy > Permissions.",
          [{ text: "OK" }]
        )
        return
      }
      setHasPermission(true)
    }

    const newSettings = { ...settings, enabled }
    setSettings(newSettings)
    await saveSMSImportSettings(newSettings)
  }

  const handleToggleScanOnLaunch = async (scanOnLaunch: boolean) => {
    if (!settings) return

    const newSettings = { ...settings, scanOnLaunch }
    setSettings(newSettings)
    await saveSMSImportSettings(newSettings)
  }

  if (isLoading || !settings) {
    return null
  }

  return (
    <YStack gap="$3">
      <XStack alignItems="center" gap="$2">
        <MessageSquare size={20} color="white" />
        <Text fontSize="$5" fontWeight="600" color="white">
          SMS Import
        </Text>
      </XStack>

      <Text fontSize="$3" color="gray">
        Automatically detect expenses from bank SMS messages
      </Text>

      <Separator marginVertical="$2" />

      {/* Enable/Disable Toggle */}
      <XStack justifyContent="space-between" alignItems="center">
        <YStack>
          <Text color="white" fontSize="$4">
            Enable SMS Import
          </Text>
          <Text fontSize="$2" color="gray">
            {settings.enabled
              ? hasPermission
                ? "Active - monitoring bank SMS"
                : "Permission needed"
              : "Disabled"}
          </Text>
        </YStack>
        <Switch
          checked={settings.enabled}
          onCheckedChange={handleToggleEnabled}
          backgroundColor={settings.enabled ? "green" : undefined}
        >
          <Switch.Thumb />
        </Switch>
      </XStack>

      {/* Scan on Launch Toggle */}
      {settings.enabled && (
        <>
          <XStack justifyContent="space-between" alignItems="center" marginTop="$2">
            <YStack>
              <Text color="white" fontSize="$4">
                Scan on App Launch
              </Text>
              <Text fontSize="$2" color="gray">
                Check for new SMS when app opens
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
          <YStack
            backgroundColor={hasPermission ? "$green2" : "$red2"}
            padding="$3"
            borderRadius="$2"
            marginTop="$2"
          >
            <Text fontSize="$3" color={hasPermission ? "green" : "red"}>
              {hasPermission
                ? "SMS permission granted"
                : "SMS permission not granted. Tap the toggle above to grant permission."}
            </Text>
          </YStack>
        </>
      )}

      {/* Info Note */}
      <Text fontSize="$2" color="gray" marginTop="$2">
        All imported expenses will be added to a review queue for your confirmation before
        being saved.
      </Text>
    </YStack>
  )
}
