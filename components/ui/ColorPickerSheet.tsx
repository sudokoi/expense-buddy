import { useCallback, memo } from "react"
import { YStack, XStack, useTheme } from "tamagui"
import { Pressable } from "react-native"
import { Check } from "@tamagui/lucide-icons-2"
import { CATEGORY_COLOR_PALETTE } from "../../constants/category-colors"
import { getColorValue } from "../../tamagui.config"
import { AppSheetScaffold } from "./AppSheetScaffold"
import { useTranslation } from "react-i18next"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_ICON_SIZE,
  UI_BORDER_WIDTH,
} from "../../constants/ui-tokens"

interface ColorPickerSheetProps {
  /** Whether the sheet is open */
  open: boolean
  /** Callback when sheet is closed */
  onClose: () => void
  /** Currently selected color (hex) */
  selectedColor: string
  /** Callback when a color is selected */
  onSelect: (color: string) => void
}

/**
 * ColorPickerSheet - Sheet for selecting category colors
 * Displays a grid of pastel colors from the palette
 */
export function ColorPickerSheet({
  open,
  onClose,
  selectedColor,
  onSelect,
}: ColorPickerSheetProps) {
  const { t } = useTranslation()
  // Handle color selection - select and close
  const handleColorSelect = useCallback(
    (color: string) => {
      onSelect(color)
      onClose()
    },
    [onSelect, onClose]
  )

  return (
    <AppSheetScaffold
      open={open}
      onClose={onClose}
      title={t("settings.categories.form.chooseColor")}
      snapPoints={[50]}
      unmountWhenClosed
    >
      <XStack flexDirection="row" flexWrap="wrap" gap={UI_SPACE.section} justify="center">
        {CATEGORY_COLOR_PALETTE.map((color) => (
          <ColorButton
            key={color}
            color={color}
            isSelected={selectedColor === color}
            onSelect={handleColorSelect}
          />
        ))}
      </XStack>
    </AppSheetScaffold>
  )
}

interface ColorButtonProps {
  color: string
  isSelected: boolean
  onSelect: (color: string) => void
}

/**
 * ColorButton - Individual color swatch button
 */
const ColorButton = memo(function ColorButton({
  color,
  isSelected,
  onSelect,
}: ColorButtonProps) {
  const theme = useTheme()
  const selectedBorderColor = getColorValue(theme.borderColorFocus)
  const checkColor = getColorValue(theme.color)

  const handlePress = useCallback(() => {
    onSelect(color)
  }, [onSelect, color])

  return (
    <Pressable onPress={handlePress}>
      <YStack
        width={UI_ICON_SIZE.huge}
        height={UI_ICON_SIZE.huge}
        rounded={UI_RADIUS.chip}
        items="center"
        justify="center"
        borderWidth={UI_BORDER_WIDTH.thick}
        style={{
          backgroundColor: color,
          borderColor: isSelected ? selectedBorderColor : "transparent",
        }}
      >
        {isSelected && (
          <Check size={UI_ICON_SIZE.large} color={checkColor} position="absolute" />
        )}
      </YStack>
    </Pressable>
  )
})

export type { ColorPickerSheetProps }
