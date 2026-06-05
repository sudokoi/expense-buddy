import { memo, type ReactNode } from "react"
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

interface ToggleRowProps {
  label: string
  help: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

const ToggleRow = memo(function ToggleRow({
  label,
  help,
  checked,
  onCheckedChange,
  disabled,
}: ToggleRowProps) {
  return (
    <XStack
      bg="$backgroundHover"
      items="center"
      justify="space-between"
      px={UI_SPACE.section}
      py={UI_SPACE.section}
      rounded={UI_RADIUS.chip}
    >
      <YStack flex={1}>
        <Label>{label}</Label>
        <Text
          fontSize="$caption"
          color="$color"
          opacity={UI_OPACITY.subtle}
          mt={UI_SPACE.micro}
        >
          {help}
        </Text>
      </YStack>
      <Switch
        size="$control"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        bg="$gray8"
        activeStyle={{ backgroundColor: SEMANTIC_COLORS.success }}
        opacity={disabled ? UI_OPACITY.subtle : 1}
      >
        <Switch.Thumb />
      </Switch>
    </XStack>
  )
})

export interface AutoSyncSectionProps {
  autoSyncEnabled: boolean
  autoSyncTiming: AutoSyncTiming
  syncSettings: boolean
  reconciliationRequired?: boolean
  onAutoSyncEnabledChange: (enabled: boolean) => void
  onAutoSyncTimingChange: (timing: AutoSyncTiming) => void
  onSyncSettingsChange: (enabled: boolean) => void
}

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

      <ToggleRow
        label={t("settings.autoSync.enable")}
        help={t("settings.autoSync.enableHelp")}
        checked={autoSyncEnabled}
        onCheckedChange={onAutoSyncEnabledChange}
        disabled={reconciliationRequired}
      />

      <ToggleRow
        label={t("settings.autoSync.syncSettings")}
        help={t("settings.autoSync.syncSettingsHelp")}
        checked={syncSettings}
        onCheckedChange={onSyncSettingsChange}
      />

      {autoSyncEnabled && (
        <YStack
          gap="$control"
          style={{ marginTop: UI_SPACE.micro, borderRadius: UI_RADIUS.surface }}
          bg="$backgroundHover"
          p="$section"
        >
          <Label>{t("settings.autoSync.whenToSync")}</Label>
          <RadioGroup
            value={autoSyncTiming}
            onValueChange={(value) => onAutoSyncTimingChange(value as AutoSyncTiming)}
          >
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
