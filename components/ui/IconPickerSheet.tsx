import { useCallback, memo } from "react"
import { YStack, XStack, Text, Button, Sheet, H4, ScrollView } from "tamagui"
import { ViewStyle, Pressable } from "react-native"
import { X, Check } from "@tamagui/lucide-icons"
import { CATEGORY_ICON_GROUPS } from "../../constants/category-icons"
import { ACCENT_COLORS, getReadableTextColor } from "../../constants/theme-colors"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"

// Layout styles
const layoutStyles = {
  sheetFrame: {
    padding: 16,
  } as ViewStyle,
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  contentContainer: {
    marginTop: 8,
  } as ViewStyle,
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
  // Handle icon selection - select and close
  const handleIconSelect = useCallback(
    (iconName: string) => {
      onSelect(iconName)
      onClose()
    },
    [onSelect, onClose]
  )

  // Don't render content when closed to improve performance
  if (!open) {
    return null
  }

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) onClose()
      }}
      snapPoints={[90]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Frame style={layoutStyles.sheetFrame} bg="$background">
        <Sheet.Handle />

        <YStack gap="$4" style={layoutStyles.contentContainer}>
          {/* Header */}
          <XStack style={layoutStyles.headerRow}>
            <H4>Choose Icon</H4>
            <Button size="$3" chromeless icon={X} onPress={onClose} aria-label="Close" />
          </XStack>

          {/* Scrollable icon groups */}
          <ScrollView showsVerticalScrollIndicator={false}>
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
          </ScrollView>
        </YStack>
      </Sheet.Frame>
    </Sheet>
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
