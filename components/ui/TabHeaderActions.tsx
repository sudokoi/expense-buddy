import { View } from "react-native"
import { Download, RefreshCw } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { useDisplayDensity } from "../../hooks/use-display-density"
import { IconActionButton } from "./IconActionButton"

interface TabHeaderActionsProps {
  syncAvailable: boolean
  isSyncing: boolean
  isScanningSmsImports: boolean
  pendingSmsCount: number
  onSync: () => void
  onImport: () => void
}

/** Shared presentation; the tab layout owns actions and their busy state. */
export function TabHeaderActions({
  syncAvailable,
  isSyncing,
  isScanningSmsImports,
  pendingSmsCount,
  onSync,
  onImport,
}: TabHeaderActionsProps) {
  const { t } = useTranslation()
  const { icon } = useDisplayDensity()
  const importLabel = isScanningSmsImports
    ? t("settings.smsImport.actions.scanning")
    : pendingSmsCount > 0
      ? t("add.importSmsWithPending", { count: pendingSmsCount })
      : t("add.importSms")

  return (
    <View className="flex-row items-center gap-ui-control pr-ui-control">
      {syncAvailable ? (
        <IconActionButton
          icon={<RefreshCw size={icon.medium} />}
          onPress={onSync}
          tooltip={t("settings.autoSync.syncNow")}
          disabled={isSyncing}
          spinning={isSyncing}
        />
      ) : null}
      <IconActionButton
        icon={
          <View
            pointerEvents="none"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <Download size={icon.medium} />
            {pendingSmsCount > 0 ? (
              <View className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-background bg-accent" />
            ) : null}
          </View>
        }
        onPress={onImport}
        tooltip={importLabel}
        disabled={isScanningSmsImports}
      />
    </View>
  )
}
