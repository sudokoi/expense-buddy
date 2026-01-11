import { useCallback, memo } from "react"
import { YStack, XStack, Button, Sheet, H4, useTheme } from "tamagui"
import { ViewStyle, Pressable } from "react-native"
import { X, Check } from "@tamagui/lucide-icons"
import { CATEGORY_COLOR_PALETTE } from "../../constants/category-colors"
import { getColorValue } from "../../tamagui.config"

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
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  } as ViewStyle,
  colorButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  } as ViewStyle,
  selectedIndicator: {
    position: "absolute",
  } as ViewStyle,
}

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
  // Handle color selection - select and close
  const handleColorSelect = useCallback(
    (color: string) => {
      onSelect(color)
      onClose()
    },
    [onSelect, onClose]
  )

  // Don't render content when closed
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
      snapPoints={[50]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Frame style={layoutStyles.sheetFrame} bg="$background">
        <Sheet.Handle />

        <YStack gap="$4" style={layoutStyles.contentContainer}>
          {/* Header */}
          <XStack style={layoutStyles.headerRow}>
            <H4>Choose Color</H4>
            <Button size="$3" chromeless icon={X} onPress={onClose} aria-label="Close" />
          </XStack>

          {/* Color grid */}
          <XStack style={layoutStyles.colorGrid}>
            {CATEGORY_COLOR_PALETTE.map((color) => (
              <ColorButton
                key={color}
                color={color}
                isSelected={selectedColor === color}
                onSelect={handleColorSelect}
              />
            ))}
          </XStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
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
        style={[
          layoutStyles.colorButton,
          {
            backgroundColor: color,
            borderColor: isSelected ? selectedBorderColor : "transparent",
          },
        ]}
      >
        {isSelected && (
          <Check size={24} color={checkColor} style={layoutStyles.selectedIndicator} />
        )}
      </YStack>
    </Pressable>
  )
})

export type { ColorPickerSheetProps }
