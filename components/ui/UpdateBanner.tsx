import { View as RNView, ViewStyle, Pressable, Text } from "react-native"
import { Download, X } from "lucide-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { Button } from "./Button"
import { SEMANTIC_COLORS, NOTIFICATION_STYLE_TOKENS } from "../../constants/theme-colors"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_Z_INDEX,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"

interface UpdateBannerProps {
  /** The version number to display */
  version?: string | null
  /** Whether the update is already downloaded */
  readyToInstall?: boolean
  /** Callback when user taps the Update button */
  onUpdate: () => void
  /** Callback when user taps the Dismiss button */
  onDismiss: () => void
}

/**
 * UpdateBanner - A non-blocking notification banner for app updates
 */
export function UpdateBanner({
  version,
  readyToInstall = false,
  onUpdate,
  onDismiss,
}: UpdateBannerProps) {
  const { t } = useTranslation()
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
    borderWidth: UI_BORDER_WIDTH.normal,
    borderColor: infoStyles.borderColor,
    paddingVertical: UI_SPACE.section,
    paddingHorizontal: UI_SPACE.gutter,
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
    borderRadius: UI_RADIUS.chip,
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
            <Download size={UI_ICON_SIZE.regular} color={textColor as `#${string}`} />
          </RNView>
          <Text
            className="text-xs"
            style={{
              fontWeight: UI_FONT_WEIGHT.medium,
              color: textColor,
              flex: 1,
            }}
            numberOfLines={2}
            testID="update-banner-version"
          >
            {readyToInstall
              ? t("updateChecker.readyToInstall")
              : version
                ? t("updateChecker.versionAvailable", { version })
                : t("updateChecker.updateAvailable")}
          </Text>
        </RNView>

        <RNView style={actionsStyle}>
          <Button
            size="chip"
            className="rounded-round"
            style={{ backgroundColor: infoStyles.actionBg }}
            onPress={onUpdate}
            testID="update-banner-update-button"
          >
            <Text
              className="text-[11px]"
              style={{ fontWeight: UI_FONT_WEIGHT.semiBold, color: textColor }}
            >
              {readyToInstall ? t("updateChecker.install") : t("updateChecker.update")}
            </Text>
          </Button>

          <Pressable
            onPress={onDismiss}
            hitSlop={UI_SPACE.control}
            testID="update-banner-dismiss-button"
            accessibilityLabel={t("common.close")}
            accessibilityRole="button"
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
              padding: UI_SPACE.micro,
            })}
          >
            <X size={UI_ICON_SIZE.regular} color={textColor as `#${string}`} />
          </Pressable>
        </RNView>
      </RNView>
    </RNView>
  )
}

export type { UpdateBannerProps }
