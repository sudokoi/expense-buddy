import { useState, useCallback, useMemo, useRef } from "react"
import { YStack, XStack, Text, Input, Button, Label, Sheet, H4 } from "tamagui"
import { ViewStyle, Keyboard, Pressable } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Check, X } from "@tamagui/lucide-icons"
import { Category } from "../../types/category"
import { validateCategoryForm } from "../../utils/category-validation"
import { IconPickerSheet } from "./IconPickerSheet"
import { ColorPickerSheet } from "./ColorPickerSheet"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { ACCENT_COLORS, getReadableTextColor } from "../../constants/theme-colors"
import { getColorValue } from "../../tamagui.config"
import { CATEGORY_COLORS } from "../../constants/category-colors"

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
  buttonRow: {
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  } as ViewStyle,
  iconPickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
  } as ViewStyle,
  iconPreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  colorPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
  } as ViewStyle,
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
  } as ViewStyle,
}

interface CategoryFormModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when modal is closed */
  onClose: () => void
  /** Category to edit (if provided, edit mode; otherwise create mode) */
  category?: Category
  /** Existing category labels for uniqueness validation */
  existingLabels: string[]
  /** Callback when category is saved */
  onSave: (category: Omit<Category, "order" | "updatedAt">) => void
}

/**
 * CategoryFormModal - Sheet-based modal for adding/editing categories
 * Includes label input with validation, icon picker, and color display
 */
export function CategoryFormModal({
  open,
  onClose,
  category,
  existingLabels,
  onSave,
}: CategoryFormModalProps) {
  // Get safe area insets
  const insets = useSafeAreaInsets()

  // Determine if we're in edit mode
  const isEditMode = !!category

  // Form state - derived from props when modal opens
  const [label, setLabel] = useState("")
  const [icon, setIcon] = useState("Circle")
  const [color, setColor] = useState(CATEGORY_COLORS.Other)

  // Icon picker state
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  // Color picker state
  const [colorPickerOpen, setColorPickerOpen] = useState(false)

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Track previous open state to detect when modal opens
  const prevOpenRef = useRef(open)

  // Reset form when modal opens (transition from closed to open)
  // Using flushSync pattern to batch state updates
  if (open && !prevOpenRef.current) {
    // Synchronous reset before render completes
    prevOpenRef.current = open
    // These will be batched by React
    if (label !== (category?.label ?? "")) {
      setLabel(category?.label ?? "")
    }
    if (icon !== (category?.icon ?? "Circle")) {
      setIcon(category?.icon ?? "Circle")
    }
    if (color !== (category?.color ?? CATEGORY_COLORS.Other)) {
      setColor(category?.color ?? CATEGORY_COLORS.Other)
    }
    if (Object.keys(errors).length > 0) {
      setErrors({})
    }
  } else if (!open && prevOpenRef.current) {
    prevOpenRef.current = open
  }

  // Handle label change with error clearing
  const handleLabelChange = useCallback(
    (text: string) => {
      setLabel(text)
      if (errors.label) {
        setErrors((prev) => {
          const { label: _, ...rest } = prev
          return rest
        })
      }
    },
    [errors.label]
  )

  // Handle icon selection
  const handleIconSelect = useCallback((iconName: string) => {
    setIcon(iconName)
  }, [])

  // Handle color selection
  const handleColorSelect = useCallback((selectedColor: string) => {
    setColor(selectedColor)
  }, [])

  // Handle save with validation
  const handleSave = useCallback(() => {
    Keyboard.dismiss()

    const validation = validateCategoryForm(
      { label, icon, color },
      existingLabels,
      isEditMode ? category?.label : undefined
    )

    if (!validation.success) {
      setErrors(validation.errors)
      return
    }

    setErrors({})
    onSave({
      label: label.trim(),
      icon,
      color,
      isDefault: category?.isDefault ?? false,
    })
    onClose()
  }, [label, icon, color, existingLabels, isEditMode, category, onSave, onClose])

  // Handle close
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Resolved color for display
  const resolvedColor = useMemo(() => getColorValue(color), [color])
  const iconColor = useMemo(() => getReadableTextColor(resolvedColor), [resolvedColor])

  // Handle opening icon picker
  const handleOpenIconPicker = useCallback(() => {
    setIconPickerOpen(true)
  }, [])

  // Handle closing icon picker
  const handleCloseIconPicker = useCallback(() => {
    setIconPickerOpen(false)
  }, [])

  // Handle opening color picker
  const handleOpenColorPicker = useCallback(() => {
    setColorPickerOpen(true)
  }, [])

  // Handle closing color picker
  const handleCloseColorPicker = useCallback(() => {
    setColorPickerOpen(false)
  }, [])

  // Computed style with safe area padding
  const frameStyle = useMemo(
    () => ({
      ...layoutStyles.sheetFrame,
      paddingBottom: Math.max(insets.bottom, 16),
    }),
    [insets.bottom]
  )

  return (
    <>
      <Sheet
        modal
        open={open}
        onOpenChange={(isOpen: boolean) => {
          if (!isOpen) handleClose()
        }}
        snapPoints={[90]}
        dismissOnSnapToBottom
      >
        <Sheet.Overlay />
        <Sheet.Frame style={frameStyle} bg="$background">
          <Sheet.Handle />

          <YStack gap="$4" style={layoutStyles.contentContainer}>
            {/* Header */}
            <XStack style={layoutStyles.headerRow}>
              <H4>{isEditMode ? "Edit Category" : "Add Category"}</H4>
              <Button
                size="$3"
                chromeless
                icon={X}
                onPress={handleClose}
                aria-label="Close"
              />
            </XStack>

            {/* Label Input */}
            <YStack gap="$2">
              <Label color="$color" opacity={0.8}>
                Category Name
              </Label>
              <Input
                size="$4"
                placeholder="e.g., Subscriptions"
                value={label}
                onChangeText={handleLabelChange}
                maxLength={30}
                borderWidth={2}
                borderColor={errors.label ? "$red10" : "$borderColor"}
                focusStyle={{
                  borderColor: errors.label ? "$red10" : ACCENT_COLORS.primary,
                }}
              />
              {errors.label && (
                <Text fontSize="$2" color="$red10">
                  {errors.label}
                </Text>
              )}
              <Text fontSize="$2" color="$color" opacity={0.5}>
                {label.length}/30 characters
              </Text>
            </YStack>

            {/* Icon Picker Trigger */}
            <YStack gap="$2">
              <Label color="$color" opacity={0.8}>
                Icon
              </Label>
              <Pressable onPress={handleOpenIconPicker}>
                <XStack
                  style={layoutStyles.iconPickerTrigger}
                  bg="$backgroundHover"
                  borderColor="$borderColor"
                >
                  <YStack
                    style={[layoutStyles.iconPreview, { backgroundColor: resolvedColor }]}
                  >
                    <DynamicCategoryIcon name={icon} size={24} color={iconColor} />
                  </YStack>
                  <YStack flex={1}>
                    <Text fontWeight="500">{icon}</Text>
                    <Text fontSize="$2" color="$color" opacity={0.6}>
                      Tap to change icon
                    </Text>
                  </YStack>
                </XStack>
              </Pressable>
            </YStack>

            {/* Color Picker Trigger */}
            <YStack gap="$2">
              <Label color="$color" opacity={0.8}>
                Color
              </Label>
              <Pressable onPress={handleOpenColorPicker}>
                <XStack
                  style={layoutStyles.colorPreview}
                  bg="$backgroundHover"
                  borderColor="$borderColor"
                >
                  <YStack
                    style={[layoutStyles.colorSwatch, { backgroundColor: resolvedColor }]}
                  />
                  <YStack flex={1}>
                    <Text fontWeight="500">{color}</Text>
                    <Text fontSize="$2" color="$color" opacity={0.6}>
                      Tap to change color
                    </Text>
                  </YStack>
                </XStack>
              </Pressable>
            </YStack>

            {/* Action Buttons */}
            <XStack style={layoutStyles.buttonRow}>
              <Button size="$4" chromeless onPress={handleClose}>
                Cancel
              </Button>
              <Button
                size="$4"
                themeInverse
                onPress={handleSave}
                icon={<Check size="$1" />}
                fontWeight="bold"
              >
                {isEditMode ? "Save Changes" : "Add Category"}
              </Button>
            </XStack>
          </YStack>
        </Sheet.Frame>
      </Sheet>

      {/* Icon Picker Sheet */}
      <IconPickerSheet
        open={iconPickerOpen}
        onClose={handleCloseIconPicker}
        selectedIcon={icon}
        onSelect={handleIconSelect}
      />

      {/* Color Picker Sheet */}
      <ColorPickerSheet
        open={colorPickerOpen}
        onClose={handleCloseColorPicker}
        selectedColor={color}
        onSelect={handleColorSelect}
      />
    </>
  )
}

export type { CategoryFormModalProps }
