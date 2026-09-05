import { Text, View } from "react-native"
import { AutoSyncTiming } from "../../../services/settings-manager"
import { useTranslation } from "react-i18next"
import { Label } from "../Label"
import { Switch } from "../Switch"
import { RadioGroup } from "../RadioGroup"

/**
 * Props for the AutoSyncSection component
 *
 * This component handles the auto-sync options UI including:
 * - Enable/disable auto-sync toggle
 * - Sync settings toggle (include theme and preferences)
 * - Auto-sync timing selection (on launch vs on change)
 */
export interface AutoSyncSectionProps {
  /** Whether auto-sync is enabled */
  autoSyncEnabled: boolean
  /** When to trigger auto-sync */
  autoSyncTiming: AutoSyncTiming
  /** Whether to sync settings to GitHub */
  syncSettings: boolean
  /** Callback when auto-sync enabled changes */
  onAutoSyncEnabledChange: (enabled: boolean) => void
  /** Callback when auto-sync timing changes */
  onAutoSyncTimingChange: (timing: AutoSyncTiming) => void
  /** Callback when sync settings changes */
  onSyncSettingsChange: (enabled: boolean) => void
}

/**
 * AutoSyncSection - Auto-sync options UI
 *
 * Provides controls for:
 * - Enabling/disabling auto-sync
 * - Choosing whether to sync settings
 * - Selecting when to sync (on launch or on change)
 */
export function AutoSyncSection({
  autoSyncEnabled,
  autoSyncTiming,
  syncSettings,
  onAutoSyncEnabledChange,
  onAutoSyncTimingChange,
  onSyncSettingsChange,
}: AutoSyncSectionProps) {
  const { t } = useTranslation()

  const handleAutoSyncTimingChange = (value: string) => {
    onAutoSyncTimingChange(value as AutoSyncTiming)
  }

  return (
    <View className="gap-3 border-t border-border pt-4">
      <Text className="text-[13px] font-bold text-foreground opacity-80">
        {t("settings.autoSync.title")}
      </Text>

      {/* Enable Auto-Sync Toggle */}
      <View className="bg-surface flex-row items-center justify-between px-3 py-3 rounded-chip">
        <View className="flex-1">
          <Label>{t("settings.autoSync.enable")}</Label>
          <Text className="text-xs text-foreground opacity-60 mt-1">
            {t("settings.autoSync.enableHelp")}
          </Text>
        </View>
        <Switch
          checked={autoSyncEnabled}
          onCheckedChange={onAutoSyncEnabledChange}
          accessibilityLabel={t("settings.autoSync.enable")}
        />
      </View>

      {/* Also sync settings toggle */}
      <View className="bg-surface flex-row items-center justify-between px-3 py-3 rounded-chip">
        <View className="flex-1">
          <Label>{t("settings.autoSync.syncSettings")}</Label>
          <Text className="text-xs text-foreground opacity-60 mt-1">
            {t("settings.autoSync.syncSettingsHelp")}
          </Text>
        </View>
        <Switch
          checked={syncSettings}
          onCheckedChange={onSyncSettingsChange}
          accessibilityLabel={t("settings.autoSync.syncSettings")}
        />
      </View>

      {/* When to Sync - only shown when auto-sync is enabled */}
      {autoSyncEnabled && (
        <View className="gap-2 mt-1 rounded-card bg-surface p-3">
          <Label>{t("settings.autoSync.whenToSync")}</Label>
          <RadioGroup value={autoSyncTiming} onValueChange={handleAutoSyncTimingChange}>
            <RadioGroup.Item
              value="on_launch"
              accessibilityLabel={t("settings.autoSync.onLaunch")}
            >
              <View className="flex-1">
                <Label>{t("settings.autoSync.onLaunch")}</Label>
                <Text className="text-xs text-foreground opacity-60">
                  {t("settings.autoSync.onLaunchHelp")}
                </Text>
              </View>
            </RadioGroup.Item>

            <RadioGroup.Item
              value="on_change"
              accessibilityLabel={t("settings.autoSync.onChange")}
            >
              <View className="flex-1">
                <Label>{t("settings.autoSync.onChange")}</Label>
                <Text className="text-xs text-foreground opacity-60">
                  {t("settings.autoSync.onChangeHelp")}
                </Text>
              </View>
            </RadioGroup.Item>
          </RadioGroup>
        </View>
      )}
    </View>
  )
}

export type { AutoSyncTiming }
