import { useCallback, memo } from "react"
import { YStack, XStack, Text } from "tamagui"
import { ViewStyle, Pressable } from "react-native"
import { Check } from "@tamagui/lucide-icons"
import { CATEGORY_ICON_GROUPS } from "../../constants/category-icons"
import { ACCENT_COLORS, getReadableTextColor } from "../../constants/theme-colors"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { AppSheetScaffold } from "./AppSheetScaffold"
import { useTranslation } from "react-i18next"

// Layout styles
const layoutStyles = {
  groupContainer: {
    marginBottom: 16,
  } as ViewStyle,
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  } as ViewStyle,
  selectedIndicator: {
    position: "absolute",
    top: 2,
    right: 2,
  } as ViewStyle,
}

interface IconPickerSheetProps {
  /** Whether the sheet is open */
  open: boolean
  /** Callback when sheet is closed */
  onClose: () => void
  /** Currently selected icon name */
  selectedIcon: string
  /** Callback when an icon is selected */
  onSelect: (iconName: string) => void
}

/**
 * IconPickerSheet - Full-screen sheet for selecting category icons
 * Displays icons grouped by CATEGORY_ICON_GROUPS with visual selection indicator
 */
export function IconPickerSheet({
  open,
  onClose,
  selectedIcon,
  onSelect,
}: IconPickerSheetProps) {
  const { t } = useTranslation()
  // Handle icon selection - select and close
  const handleIconSelect = useCallback(
    (iconName: string) => {
      onSelect(iconName)
      onClose()
    },
    [onSelect, onClose]
  )

  return (
    <AppSheetScaffold
      open={open}
      onClose={onClose}
      title={t("settings.categories.form.chooseIcon")}
      snapPoints={[90]}
      unmountWhenClosed
      scroll
    >
      <YStack gap="$4" pb="$8">
        {CATEGORY_ICON_GROUPS.map((group) => (
          <IconGroup
            key={group.name}
            name={group.name}
            icons={group.icons}
            selectedIcon={selectedIcon}
            onSelect={handleIconSelect}
          />
        ))}
      </YStack>
    </AppSheetScaffold>
  )
}

interface IconGroupProps {
  name: string
  icons: string[]
  selectedIcon: string
  onSelect: (iconName: string) => void
}

/**
 * IconGroup - Renders a group of icons with a header
 * Memoized to prevent unnecessary re-renders
 */
const IconGroup = memo(function IconGroup({
  name,
  icons,
  selectedIcon,
  onSelect,
}: IconGroupProps) {
  return (
    <YStack gap="$2" style={layoutStyles.groupContainer}>
      <Text
        fontSize="$3"
        fontWeight="600"
        color="$color"
        opacity={0.7}
        textTransform="uppercase"
        letterSpacing={0.5}
      >
        {name}
      </Text>
      <XStack style={layoutStyles.iconGrid}>
        {icons.map((iconName) => (
          <IconButton
            key={iconName}
            iconName={iconName}
            isSelected={selectedIcon === iconName}
            onSelect={onSelect}
          />
        ))}
      </XStack>
    </YStack>
  )
})

interface IconButtonProps {
  iconName: string
  isSelected: boolean
  onSelect: (iconName: string) => void
}

/**
 * IconButton - Individual icon button with selection state
 * Memoized to prevent unnecessary re-renders when other icons change
 */
const IconButton = memo(function IconButton({
  iconName,
  isSelected,
  onSelect,
}: IconButtonProps) {
  const handlePress = useCallback(() => {
    onSelect(iconName)
  }, [onSelect, iconName])

  const selectedBg = ACCENT_COLORS.primary
  const selectedFg = getReadableTextColor(selectedBg)

  return (
    <Pressable onPress={handlePress}>
      <YStack
        style={layoutStyles.iconButton}
        bg={isSelected ? selectedBg : "$backgroundHover"}
        borderColor={isSelected ? selectedBg : "$borderColor"}
      >
        <DynamicCategoryIcon
          name={iconName}
          size={24}
          color={isSelected ? selectedFg : undefined}
        />
        {isSelected && (
          <YStack style={layoutStyles.selectedIndicator as ViewStyle}>
            <Check size={12} color={selectedFg} />
          </YStack>
        )}
      </YStack>
    </Pressable>
  )
})

export type { IconPickerSheetProps }
