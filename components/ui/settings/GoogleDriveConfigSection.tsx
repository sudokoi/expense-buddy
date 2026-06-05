import { Button, Label, Text, YStack } from "tamagui"
import { GoogleOAuthError } from "../../../services/sync/google-oauth-service"
import { useProviderManagement } from "../../../stores/hooks"
import { useTranslation } from "react-i18next"
import { UI_RADIUS, UI_SPACE, UI_OPACITY } from "../../../constants/ui-tokens"

export interface GoogleDriveConfigSectionProps {
  onNotification: (message: string, type: "success" | "error" | "info") => void
  onCancel: () => void
  onDone: () => void
}

export function GoogleDriveConfigSection({
  onNotification,
  onCancel,
  onDone,
}: GoogleDriveConfigSectionProps) {
  const { t } = useTranslation()
  const { addProvider, setActiveProvider } = useProviderManagement()

  return (
    <YStack
      bg="$backgroundHover"
      p={UI_SPACE.section}
      rounded={UI_RADIUS.surface}
      gap="$control"
      mt={UI_SPACE.gutter}
    >
      <Label>{t("settings.googleDrive.configTitle")}</Label>
      <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.subtle}>
        {t("settings.googleDrive.help")}
      </Text>
      <Button
        size="$control"
        theme="accent"
        onPress={async () => {
          const { getGoogleDriveOAuthClientId, getGoogleTokenExchangeUrl } =
            await import("../../../constants/runtime-config")
          const clientId = getGoogleDriveOAuthClientId()
          const tokenExchangeUrl = getGoogleTokenExchangeUrl() ?? ""
          if (!clientId) {
            onNotification(t("settings.googleDrive.clientIdMissing"), "error")
            return
          }
          if (!tokenExchangeUrl) {
            onNotification(t("settings.googleDrive.tokenExchangeUrlMissing"), "error")
            return
          }
          try {
            const { initiateGoogleDriveOAuth } =
              await import("../../../services/sync/google-oauth-service")
            const result = await initiateGoogleDriveOAuth(clientId, tokenExchangeUrl)
            addProvider({
              id: result.providerId,
              kind: "google_drive",
              label: "Google Drive",
              credentialId: result.providerId,
              clientId,
              tokenExchangeUrl,
              accountEmail: result.accountEmail,
            })
            setActiveProvider(result.providerId)
            onDone()
            onNotification(t("settings.googleDrive.configured"), "success")
          } catch (error) {
            if (error instanceof GoogleOAuthError) {
              if (error.code === "CANCELLED") return
              if (error.code === "CONFIG_ERROR") {
                onNotification(t("settings.googleDrive.authFailed"), "error")
                return
              }
              if (error.code === "NATIVE_MODULE_UNAVAILABLE") {
                onNotification(t("settings.googleDrive.nativeModuleError"), "error")
                return
              }
              if (error.stage === "exchange") {
                onNotification(t("settings.googleDrive.authFailed"), "error")
                return
              }
            }
            onNotification(t("common.error"), "error")
          }
        }}
      >
        {t("settings.providers.addGoogleDrive")}
      </Button>
      <Button size="$control" onPress={onCancel}>
        {t("common.cancel")}
      </Button>
    </YStack>
  )
}
