import { useState, useCallback, useMemo, useRef } from "react"
import { Keyboard, Pressable, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Check } from "lucide-react-native"
import { Category } from "../../types/category"
import { validateCategoryForm } from "../../utils/category-validation"
import { IconPickerSheet } from "./IconPickerSheet"
import { ColorPickerSheet } from "./ColorPickerSheet"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { getReadableTextColor } from "../../constants/theme-colors"
import { CATEGORY_COLORS } from "../../constants/category-colors"
import { AppSheetScaffold } from "./AppSheetScaffold"
import { Button } from "./Button"
import { Input } from "./Input"
import { Label } from "./Label"
import { useTranslation } from "react-i18next"
import { UI_RADIUS, UI_SPACE, UI_ICON_SIZE } from "../../constants/ui-tokens"

const layoutStyles = {
  iconPreview: {
    width: UI_ICON_SIZE.xxxlarge,
    height: UI_ICON_SIZE.xxxlarge,
    borderRadius: UI_RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatch: {
    width: UI_ICON_SIZE.xlarge,
    height: UI_ICON_SIZE.xlarge,
    borderRadius: UI_RADIUS.control,
  },
  sheetFrame: {
    paddingHorizontal: UI_SPACE.gutter,
  },
} as const

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
  const { t } = useTranslation()

  // Determine if we're in edit mode
  const isEditMode = !!category

  // Form state - derived from props when modal opens
  const [label, setLabel] = useState("")
  const [icon, setIcon] = useState("Circle")
  const [color, setColor] = useState<string>(CATEGORY_COLORS.Other)

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
      isEditMode ? category?.label : undefined,
      t
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
  }, [label, icon, color, existingLabels, isEditMode, category, onSave, onClose, t])

  // Handle close
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Resolved color for display
  const resolvedColor = color
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
      paddingBottom: Math.max(insets.bottom, UI_SPACE.gutter),
    }),
    [insets.bottom]
  )

  return (
    <>
      <AppSheetScaffold
        open={open}
        onClose={handleClose}
        title={
          isEditMode
            ? t("settings.categories.form.editTitle")
            : t("settings.categories.form.addTitle")
        }
        snapPoints={[90]}
        scroll
        frameStyle={frameStyle}
      >
        <View className="gap-4">
          {/* Label Input */}
          <View className="gap-2">
            <Label className="opacity-80">
              {t("settings.categories.form.nameLabel")}
            </Label>
            <Input
              className={errors.label ? "border-error" : undefined}
              placeholder={t("settings.categories.form.namePlaceholder")}
              value={label}
              onChangeText={handleLabelChange}
              maxLength={30}
              accessibilityLabel={t("settings.categories.form.nameLabel")}
            />
            {errors.label && <Text className="text-xs text-error">{errors.label}</Text>}
            <Text className="text-xs text-muted-foreground">
              {t("settings.categories.form.characterCount", {
                count: label.length,
                max: 30,
              })}
            </Text>
          </View>

          {/* Icon Picker Trigger */}
          <View className="gap-2">
            <Label className="opacity-80">
              {t("settings.categories.form.iconLabel")}
            </Label>
            <Pressable
              onPress={handleOpenIconPicker}
              accessibilityRole="button"
              accessibilityLabel={t("settings.categories.form.chooseIcon")}
            >
              <View className="flex-row items-center gap-3 p-3 rounded-control border-2 bg-surface border-border">
                <View
                  style={[layoutStyles.iconPreview, { backgroundColor: resolvedColor }]}
                >
                  <DynamicCategoryIcon
                    name={icon}
                    size={UI_ICON_SIZE.large}
                    color={iconColor}
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-medium text-foreground">{icon}</Text>
                  <Text className="text-xs text-muted-foreground">
                    {t("settings.categories.form.iconHelp")}
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>

          {/* Color Picker Trigger */}
          <View className="gap-2">
            <Label className="opacity-80">
              {t("settings.categories.form.colorLabel")}
            </Label>
            <Pressable
              onPress={handleOpenColorPicker}
              accessibilityRole="button"
              accessibilityLabel={t("settings.categories.form.chooseColor")}
            >
              <View className="flex-row justify-end gap-3 mt-2">
                <View
                  style={[layoutStyles.colorSwatch, { backgroundColor: resolvedColor }]}
                />
                <View className="flex-1">
                  <Text className="font-medium text-foreground">{color}</Text>
                  <Text className="text-xs text-muted-foreground">
                    {t("settings.categories.form.colorHelp")}
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>

          {/* Action Buttons */}
          <View className="flex-row justify-end gap-3 mt-2">
            <Button size="control" variant="ghost" onPress={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button
              size="control"
              variant="accent"
              icon={<Check size={UI_ICON_SIZE.medium} />}
              onPress={handleSave}
            >
              {isEditMode ? t("common.save") : t("settings.categories.form.addTitle")}
            </Button>
          </View>
        </View>
      </AppSheetScaffold>

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
