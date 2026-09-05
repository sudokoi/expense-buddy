import { useCallback, memo } from "react"
import { View, Text } from "react-native"
import { Pressable } from "react-native"
import { Check } from "lucide-react-native"
import { CATEGORY_ICON_GROUPS } from "../../constants/category-icons"
import { getReadableTextColor } from "../../constants/theme-colors"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { AppSheetScaffold } from "./AppSheetScaffold"
import { useTranslation } from "react-i18next"
import {
  UI_SPACE,
  UI_OPACITY,
  UI_ICON_SIZE,
  UI_BORDER_WIDTH,
  UI_COMPACT_TOUCH_TARGET,
} from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"

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
 */
export function IconPickerSheet({
  open,
  onClose,
  selectedIcon,
  onSelect,
}: IconPickerSheetProps) {
  const { t } = useTranslation()
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
      <View className="gap-4 pb-10">
        {CATEGORY_ICON_GROUPS.map((group) => (
          <IconGroup
            key={group.name}
            name={group.name}
            icons={group.icons}
            selectedIcon={selectedIcon}
            onSelect={handleIconSelect}
          />
        ))}
      </View>
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
 */
const IconGroup = memo(function IconGroup({
  name,
  icons,
  selectedIcon,
  onSelect,
}: IconGroupProps) {
  return (
    <View className="mb-4 gap-2">
      <Text
        className="text-body font-semibold uppercase text-foreground"
        style={{ opacity: UI_OPACITY.medium }}
      >
        {name}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {icons.map((iconName) => (
          <IconButton
            key={iconName}
            iconName={iconName}
            isSelected={selectedIcon === iconName}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  )
})

interface IconButtonProps {
  iconName: string
  isSelected: boolean
  onSelect: (iconName: string) => void
}

/**
 * IconButton - Individual icon button with selection state
 */
const IconButton = memo(function IconButton({
  iconName,
  isSelected,
  onSelect,
}: IconButtonProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const handlePress = useCallback(() => {
    onSelect(iconName)
  }, [onSelect, iconName])

  const selectedBg = theme.accent
  const selectedFg = getReadableTextColor(selectedBg)

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t("ui.selectIcon", { icon: iconName })}
      accessibilityState={{ selected: isSelected }}
    >
      <View
        className="items-center justify-center rounded-chip"
        style={{
          width: UI_COMPACT_TOUCH_TARGET,
          height: UI_COMPACT_TOUCH_TARGET,
          borderWidth: UI_BORDER_WIDTH.normal,
          backgroundColor: isSelected ? selectedBg : theme.surface,
          borderColor: isSelected ? selectedBg : theme.border,
        }}
      >
        <DynamicCategoryIcon
          name={iconName}
          size={UI_ICON_SIZE.medium}
          color={isSelected ? selectedFg : undefined}
        />
        {isSelected && (
          <View
            className="absolute"
            style={{ top: UI_SPACE.micro / 2, right: UI_SPACE.micro / 2 }}
          >
            <Check size={UI_ICON_SIZE.micro} color={selectedFg} />
          </View>
        )}
      </View>
    </Pressable>
  )
})

export type { IconPickerSheetProps }
