import { useCallback, memo } from "react"
import { View } from "react-native"
import { Pressable } from "react-native"
import { Check } from "lucide-react-native"
import { CATEGORY_COLOR_PALETTE } from "../../constants/category-colors"
import { AppSheetScaffold } from "./AppSheetScaffold"
import { useTranslation } from "react-i18next"
import {
  UI_ICON_SIZE,
  UI_BORDER_WIDTH,
} from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"

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
      <View className="flex-row flex-wrap justify-center gap-3">
        {CATEGORY_COLOR_PALETTE.map((color) => (
          <ColorButton
            key={color}
            color={color}
            isSelected={selectedColor === color}
            onSelect={handleColorSelect}
          />
        ))}
      </View>
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
  const theme = useThemeColors()
  const selectedBorderColor = theme.accent
  const checkColor = theme.foreground

  const handlePress = useCallback(() => {
    onSelect(color)
  }, [onSelect, color])

  return (
    <Pressable onPress={handlePress}>
      <View
        className="items-center justify-center rounded-chip"
        style={{
          width: UI_ICON_SIZE.huge,
          height: UI_ICON_SIZE.huge,
          borderWidth: UI_BORDER_WIDTH.thick,
          backgroundColor: color,
          borderColor: isSelected ? selectedBorderColor : "transparent",
        }}
      >
        {isSelected && <Check size={UI_ICON_SIZE.large} color={checkColor} />}
      </View>
    </Pressable>
  )
})

export type { ColorPickerSheetProps }
