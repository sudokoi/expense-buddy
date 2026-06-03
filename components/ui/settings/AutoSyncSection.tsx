import { YStack, XStack, Text, Label, Switch, RadioGroup } from "tamagui"
import { AutoSyncTiming } from "../../../services/settings-manager"
import { SEMANTIC_COLORS } from "../../../constants/theme-colors"
import { useTranslation } from "react-i18next"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
} from "../../../constants/ui-tokens"

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
  /** Whether the active provider needs an initial manual sync first */
  reconciliationRequired?: boolean
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
  reconciliationRequired,
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
      borderTopWidth={UI_BORDER_WIDTH.thin}
      borderTopColor="$borderColor"
      style={{ paddingTop: UI_SPACE.gutter }}
    >
      {reconciliationRequired && (
        <YStack
          bg="$yellow2"
          px={UI_SPACE.section}
          py={UI_SPACE.section}
          rounded={UI_RADIUS.surface}
        >
          <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.strong}>
            {t("settings.autoSync.reconciliationRequired")}
          </Text>
        </YStack>
      )}

      <Text
        fontSize="$body"
        fontWeight={UI_FONT_WEIGHT.bold}
        color="$color"
        opacity={UI_OPACITY.strong}
      >
        {t("settings.autoSync.title")}
      </Text>

      {/* Enable Auto-Sync Toggle */}
      <XStack
        bg="$backgroundHover"
        items="center"
        justify="space-between"
        px={UI_SPACE.section}
        py={UI_SPACE.section}
        rounded={UI_RADIUS.chip}
      >
        <YStack flex={1}>
          <Label>{t("settings.autoSync.enable")}</Label>
          <Text
            fontSize="$caption"
            color="$color"
            opacity={UI_OPACITY.subtle}
            mt={UI_SPACE.micro}
          >
            {t("settings.autoSync.enableHelp")}
          </Text>
        </YStack>
        <Switch
          size="$control"
          checked={autoSyncEnabled && !reconciliationRequired}
          onCheckedChange={onAutoSyncEnabledChange}
          disabled={reconciliationRequired}
          bg="$gray8"
          activeStyle={{ backgroundColor: SEMANTIC_COLORS.success }}
          opacity={reconciliationRequired ? UI_OPACITY.subtle : 1}
        >
          <Switch.Thumb />
        </Switch>
      </XStack>

      {/* Also sync settings toggle */}
      <XStack
        bg="$backgroundHover"
        items="center"
        justify="space-between"
        px={UI_SPACE.section}
        py={UI_SPACE.section}
        rounded={UI_RADIUS.chip}
      >
        <YStack flex={1}>
          <Label>{t("settings.autoSync.syncSettings")}</Label>
          <Text
            fontSize="$caption"
            color="$color"
            opacity={UI_OPACITY.subtle}
            mt={UI_SPACE.micro}
          >
            {t("settings.autoSync.syncSettingsHelp")}
          </Text>
        </YStack>
        <Switch
          size="$control"
          checked={syncSettings}
          onCheckedChange={onSyncSettingsChange}
          bg="$gray8"
          activeStyle={{ backgroundColor: SEMANTIC_COLORS.success }}
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
            <XStack gap="$control" items="center" my={UI_SPACE.control}>
              <RadioGroup.Item value="on_launch" id="on_launch" size="$control">
                <RadioGroup.Indicator />
              </RadioGroup.Item>
              <YStack flex={1}>
                <Label htmlFor="on_launch">{t("settings.autoSync.onLaunch")}</Label>
                <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.subtle}>
                  {t("settings.autoSync.onLaunchHelp")}
                </Text>
              </YStack>
            </XStack>

            <XStack gap="$control" items="center" my={UI_SPACE.control}>
              <RadioGroup.Item value="on_change" id="on_change" size="$control">
                <RadioGroup.Indicator />
              </RadioGroup.Item>
              <YStack flex={1}>
                <Label htmlFor="on_change">{t("settings.autoSync.onChange")}</Label>
                <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.subtle}>
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
