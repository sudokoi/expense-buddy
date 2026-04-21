import { View as RNView, ViewStyle, Pressable } from "react-native"
import { Text, Button } from "tamagui"
import { Download, X } from "@tamagui/lucide-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { SEMANTIC_COLORS, NOTIFICATION_STYLE_TOKENS } from "../../constants/theme-colors"
import { UI_RADIUS, UI_SPACE, UI_Z_INDEX } from "../../constants/ui-tokens"

interface UpdateBannerProps {
  /** The version number to display */
  version: string
  /** Callback when user taps the Update button */
  onUpdate: () => void
  /** Callback when user taps the Dismiss button */
  onDismiss: () => void
}

/**
 * UpdateBanner - A non-blocking notification banner for app updates
 *
 * Displays when a new app version is available, showing:
 * - The available version number
 * - An "Update" button to navigate to the store/releases
 * - A dismiss button to hide the banner
 *
 * Uses the app's theme colors for consistency and positions
 * at the top of the screen without blocking interaction.
 */
export function UpdateBanner({ version, onUpdate, onDismiss }: UpdateBannerProps) {
  const insets = useSafeAreaInsets()
  const infoStyles = NOTIFICATION_STYLE_TOKENS.info

  const containerStyle: ViewStyle = {
    position: "absolute",
    top: insets.top + UI_SPACE.gutter,
    left: UI_SPACE.gutter,
    right: UI_SPACE.gutter,
    zIndex: UI_Z_INDEX.banner,
    backgroundColor: SEMANTIC_COLORS.info,
    borderRadius: UI_RADIUS.surface,
    borderWidth: 2,
    borderColor: infoStyles.borderColor,
    paddingVertical: UI_SPACE.section,
    paddingHorizontal: UI_SPACE.gutter,
    shadowColor: SEMANTIC_COLORS.info,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  }

  const contentStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: UI_SPACE.section - 2,
  }

  const leftContentStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: UI_SPACE.section - 2,
    flex: 1,
  }

  const iconContainerStyle: ViewStyle = {
    backgroundColor: infoStyles.iconBg,
    borderRadius: UI_RADIUS.surface + UI_SPACE.micro,
    padding: UI_SPACE.control - 2,
  }

  const actionsStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: UI_SPACE.control,
  }

  const textColor = infoStyles.textColor

  return (
    <RNView style={containerStyle} testID="update-banner">
      <RNView style={contentStyle}>
        <RNView style={leftContentStyle}>
          <RNView style={iconContainerStyle}>
            <Download size={18} color={textColor as `#${string}`} />
          </RNView>
          <Text
            fontSize={13}
            fontWeight="500"
            color={textColor}
            flex={1}
            numberOfLines={2}
            testID="update-banner-version"
          >
            Version {version} is available
          </Text>
        </RNView>

        <RNView style={actionsStyle}>
          <Button
            size="$chip"
            bg={infoStyles.actionBg}
            borderWidth={1}
            borderColor={infoStyles.actionBorderColor}
            style={{ borderRadius: UI_RADIUS.round }}
            pressStyle={{ opacity: 0.8 }}
            onPress={onUpdate}
            testID="update-banner-update-button"
          >
            <Text fontSize={12} fontWeight="600" color={textColor}>
              Update
            </Text>
          </Button>

          <Pressable
            onPress={onDismiss}
            hitSlop={UI_SPACE.control}
            testID="update-banner-dismiss-button"
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
              padding: UI_SPACE.micro,
            })}
          >
            <X size={18} color={textColor as `#${string}`} />
          </Pressable>
        </RNView>
      </RNView>
    </RNView>
  )
}

export type { UpdateBannerProps }
