import { YStack, XStack, Text, Label, Switch, RadioGroup } from "tamagui"
import { ViewStyle } from "react-native"
import { AutoSyncTiming } from "../../../services/settings-manager"
import { SEMANTIC_COLORS } from "../../../constants/theme-colors"

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
  } as ViewStyle,
  radioRow: {
    alignItems: "center",
    marginVertical: 8,
  } as ViewStyle,
  helperText: {
    marginTop: 4,
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
  const handleAutoSyncTimingChange = (value: string) => {
    onAutoSyncTimingChange(value as AutoSyncTiming)
  }

  return (
    <YStack
      gap="$3"
      borderTopWidth={1}
      borderTopColor="$borderColor"
      style={{ paddingTop: 16 }}
    >
      <Text fontSize="$4" fontWeight="600">
        Auto-Sync & Options
      </Text>

      {/* Enable Auto-Sync Toggle */}
      <XStack style={layoutStyles.autoSyncRow}>
        <YStack flex={1}>
          <Label>Enable Auto-Sync</Label>
          <Text
            fontSize="$2"
            color="$color"
            opacity={0.6}
            style={layoutStyles.helperText}
          >
            Automatically sync with GitHub when configured
          </Text>
        </YStack>
        <Switch
          size="$4"
          checked={autoSyncEnabled}
          onCheckedChange={onAutoSyncEnabledChange}
          backgroundColor={autoSyncEnabled ? SEMANTIC_COLORS.success : ("$gray8" as any)}
        >
          <Switch.Thumb />
        </Switch>
      </XStack>

      {/* Also sync settings toggle */}
      <XStack style={layoutStyles.autoSyncRow}>
        <YStack flex={1}>
          <Label>Also sync settings</Label>
          <Text
            fontSize="$2"
            color="$color"
            opacity={0.6}
            style={layoutStyles.helperText}
          >
            Include theme and preferences in sync
          </Text>
        </YStack>
        <Switch
          size="$4"
          checked={syncSettings}
          onCheckedChange={onSyncSettingsChange}
          backgroundColor={syncSettings ? SEMANTIC_COLORS.success : ("$gray8" as any)}
        >
          <Switch.Thumb />
        </Switch>
      </XStack>

      {/* When to Sync - only shown when auto-sync is enabled */}
      {autoSyncEnabled && (
        <YStack gap="$2" style={{ marginTop: 8 }}>
          <Label>When to Sync</Label>
          <RadioGroup value={autoSyncTiming} onValueChange={handleAutoSyncTimingChange}>
            <XStack gap="$2" style={layoutStyles.radioRow}>
              <RadioGroup.Item value="on_launch" id="on_launch" size="$4">
                <RadioGroup.Indicator />
              </RadioGroup.Item>
              <YStack flex={1}>
                <Label htmlFor="on_launch">On App Launch</Label>
                <Text fontSize="$2" color="$color" opacity={0.6}>
                  Sync when the app starts
                </Text>
              </YStack>
            </XStack>

            <XStack gap="$2" style={layoutStyles.radioRow}>
              <RadioGroup.Item value="on_change" id="on_change" size="$4">
                <RadioGroup.Indicator />
              </RadioGroup.Item>
              <YStack flex={1}>
                <Label htmlFor="on_change">On Every Change</Label>
                <Text fontSize="$2" color="$color" opacity={0.6}>
                  Sync immediately after making changes
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
