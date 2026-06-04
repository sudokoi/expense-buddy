import { YStack } from "tamagui"
import { useTranslation } from "react-i18next"
import { AppSheetScaffold } from "../AppSheetScaffold"
import { GitHubConfigSection } from "./GitHubConfigSection"
import type { SyncConfig } from "../../../types/sync"
import { UI_SPACE } from "../../../constants/ui-tokens"

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
    <AppSheetScaffold
      open={open}
      onClose={onClose}
      title={t("settings.github.configTitle")}
      snapPoints={[85]}
      scroll
    >
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
    </AppSheetScaffold>
  )
}
