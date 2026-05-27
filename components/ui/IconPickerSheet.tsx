import { useCallback, memo } from "react"
import { YStack, XStack, Text } from "tamagui"
import { Pressable } from "react-native"
import { Check } from "@tamagui/lucide-icons-2"
import { CATEGORY_ICON_GROUPS } from "../../constants/category-icons"
import { ACCENT_COLORS, getReadableTextColor } from "../../constants/theme-colors"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { AppSheetScaffold } from "./AppSheetScaffold"
import { useTranslation } from "react-i18next"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_ICON_SIZE,
  UI_BORDER_WIDTH,
} from "../../constants/ui-tokens"

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
      <YStack gap="$gutter" pb="$empty">
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
    <YStack gap="$control" mb={UI_SPACE.gutter}>
      <Text
        fontSize="$body"
        fontWeight={UI_FONT_WEIGHT.semiBold}
        color="$color"
        opacity={UI_OPACITY.medium}
        textTransform="uppercase"
        letterSpacing={0.5}
      >
        {name}
      </Text>
      <XStack flexDirection="row" flexWrap="wrap" gap={UI_SPACE.control}>
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
        width={UI_ICON_SIZE.huge}
        height={UI_ICON_SIZE.huge}
        rounded={UI_RADIUS.chip}
        items="center"
        justify="center"
        borderWidth={UI_BORDER_WIDTH.normal}
        bg={isSelected ? selectedBg : "$backgroundHover"}
        borderColor={isSelected ? selectedBg : "$borderColor"}
      >
        <DynamicCategoryIcon
          name={iconName}
          size={UI_ICON_SIZE.large}
          color={isSelected ? selectedFg : undefined}
        />
        {isSelected && (
          <YStack position="absolute" t={UI_SPACE.micro / 2} r={UI_SPACE.micro / 2}>
            <Check size={UI_ICON_SIZE.micro} color={selectedFg} />
          </YStack>
        )}
      </YStack>
    </Pressable>
  )
})

export type { IconPickerSheetProps }
