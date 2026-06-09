import { Dialog, H4, XStack, YStack } from "tamagui"
import { useTranslation } from "react-i18next"
import { X } from "@tamagui/lucide-icons-2"
import { GitHubConfigSection } from "./GitHubConfigSection"
import type { SyncConfig } from "../../../types/sync"
import { UI_SPACE } from "../../../constants/ui-tokens"
import { IconActionButton } from "../IconActionButton"

export interface GitHubConfigModalProps {
  open: boolean
  onClose: () => void
  syncConfig: SyncConfig | null
  onSaveConfig: (config: SyncConfig) => void
  onTestConnection: () => Promise<void>
  onClearConfig: () => void
  isTesting: boolean
  connectionStatus: "idle" | "success" | "error"
  onConnectionStatusChange: (status: "idle" | "success" | "error") => void
  onNotification: (message: string, type: "success" | "error" | "info") => void
}

export function GitHubConfigModal({
  open,
  onClose,
  syncConfig,
  onSaveConfig,
  onTestConnection,
  onClearConfig,
  isTesting,
  connectionStatus,
  onConnectionStatusChange,
  onNotification,
}: GitHubConfigModalProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      modal
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content
          style={{ width: "90%", maxWidth: 500, maxHeight: "85%" }}
          p={UI_SPACE.gutter}
        >
          <Dialog.Description asChild>
            <H4 display="none">{t("settings.github.configTitle")}</H4>
          </Dialog.Description>
          <XStack justify="space-between" items="center">
            <Dialog.Title asChild>
              <H4>{t("settings.github.configTitle")}</H4>
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconActionButton
                size="$compact"
                chromeless
                icon={X}
                tooltip={t("common.close")}
                aria-label={t("common.close")}
              />
            </Dialog.Close>
          </XStack>
          <YStack gap="$gutter" pt={UI_SPACE.control}>
            <GitHubConfigSection
              syncConfig={syncConfig}
              defaultExpanded
              onSaveConfig={(config) => {
                onSaveConfig(config)
                onClose()
              }}
              onTestConnection={onTestConnection}
              onClearConfig={onClearConfig}
              isTesting={isTesting}
              connectionStatus={connectionStatus}
              onConnectionStatusChange={onConnectionStatusChange}
              onNotification={onNotification}
            />
          </YStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
