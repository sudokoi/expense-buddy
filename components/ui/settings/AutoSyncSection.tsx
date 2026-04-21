import { YStack, XStack, Text, Label, Switch, RadioGroup } from "tamagui"
import { ViewStyle } from "react-native"
import { AutoSyncTiming } from "../../../services/settings-manager"
import { SEMANTIC_COLORS } from "../../../constants/theme-colors"
import { useTranslation } from "react-i18next"
import { UI_RADIUS, UI_SPACE } from "../../../constants/ui-tokens"

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

// Layout styles for the component
const layoutStyles = {
  autoSyncRow: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: UI_SPACE.section,
    paddingVertical: UI_SPACE.section,
    borderRadius: UI_RADIUS.chip,
  } as ViewStyle,
  radioRow: {
    alignItems: "center",
    marginVertical: UI_SPACE.control,
  } as ViewStyle,
  helperText: {
    marginTop: UI_SPACE.micro,
  },
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
    <YStack
      gap="$section"
      borderTopWidth={1}
      borderTopColor="$borderColor"
      style={{ paddingTop: UI_SPACE.gutter }}
    >
      <Text fontSize="$body" fontWeight="700" color="$color" opacity={0.8}>
        {t("settings.autoSync.title")}
      </Text>

      {/* Enable Auto-Sync Toggle */}
      <XStack bg="$backgroundHover" style={layoutStyles.autoSyncRow}>
        <YStack flex={1}>
          <Label>{t("settings.autoSync.enable")}</Label>
          <Text
            fontSize="$caption"
            color="$color"
            opacity={0.6}
            style={layoutStyles.helperText}
          >
            {t("settings.autoSync.enableHelp")}
          </Text>
        </YStack>
        <Switch
          size="$control"
          checked={autoSyncEnabled}
          onCheckedChange={onAutoSyncEnabledChange}
          backgroundColor={autoSyncEnabled ? SEMANTIC_COLORS.success : ("$gray8" as any)}
        >
          <Switch.Thumb />
        </Switch>
      </XStack>

      {/* Also sync settings toggle */}
      <XStack bg="$backgroundHover" style={layoutStyles.autoSyncRow}>
        <YStack flex={1}>
          <Label>{t("settings.autoSync.syncSettings")}</Label>
          <Text
            fontSize="$caption"
            color="$color"
            opacity={0.6}
            style={layoutStyles.helperText}
          >
            {t("settings.autoSync.syncSettingsHelp")}
          </Text>
        </YStack>
        <Switch
          size="$control"
          checked={syncSettings}
          onCheckedChange={onSyncSettingsChange}
          backgroundColor={syncSettings ? SEMANTIC_COLORS.success : ("$gray8" as any)}
        >
          <Switch.Thumb />
        </Switch>
      </XStack>

      {/* When to Sync - only shown when auto-sync is enabled */}
      {autoSyncEnabled && (
        <YStack
          gap="$control"
          style={{ marginTop: UI_SPACE.micro, borderRadius: UI_RADIUS.surface }}
          bg="$backgroundHover"
          p="$section"
        >
          <Label>{t("settings.autoSync.whenToSync")}</Label>
          <RadioGroup value={autoSyncTiming} onValueChange={handleAutoSyncTimingChange}>
            <XStack gap="$control" style={layoutStyles.radioRow}>
              <RadioGroup.Item value="on_launch" id="on_launch" size="$control">
                <RadioGroup.Indicator />
              </RadioGroup.Item>
              <YStack flex={1}>
                <Label htmlFor="on_launch">{t("settings.autoSync.onLaunch")}</Label>
                <Text fontSize="$caption" color="$color" opacity={0.6}>
                  {t("settings.autoSync.onLaunchHelp")}
                </Text>
              </YStack>
            </XStack>

            <XStack gap="$control" style={layoutStyles.radioRow}>
              <RadioGroup.Item value="on_change" id="on_change" size="$control">
                <RadioGroup.Indicator />
              </RadioGroup.Item>
              <YStack flex={1}>
                <Label htmlFor="on_change">{t("settings.autoSync.onChange")}</Label>
                <Text fontSize="$caption" color="$color" opacity={0.6}>
                  {t("settings.autoSync.onChangeHelp")}
                </Text>
              </YStack>
            </XStack>
          </RadioGroup>
        </YStack>
      )}
    </YStack>
  )
}

export type { AutoSyncTiming }
