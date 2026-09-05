import { Pressable, Text, View } from "react-native"
import { Check } from "lucide-react-native"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { getReadableTextColor } from "../../constants/palette"
import { resolveCategoryVisual } from "../../utils/resolve-category-color"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { useThemeColors } from "../../hooks/use-theme-colors"
import {
  UI_FONT_SIZE,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"
import { CompactControl } from "./CompactControl"

interface CategoryCardProps {
  isSelected: boolean
  categoryColor: string
  label: string
  onPress: () => void
  compact?: boolean
  accessibilityLabel?: string
  iconName?: string
}

/**
 * CategoryCard - A styled Card for category selection
 * Provides consistent styling for category selection cards with selected/unselected states
 * Memoized to prevent unnecessary re-renders when other categories change
 */
export const CategoryCard = memo(function CategoryCard({
  isSelected,
  categoryColor,
  label,
  onPress,
  compact = false,
  accessibilityLabel,
  iconName = "Circle",
}: CategoryCardProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const visual = resolveCategoryVisual(categoryColor, isSelected, theme)

  const displayLabel = label === "Other" ? t("settings.categories.other") : label

  const content = (
    <>
      <View
        className={
          compact
            ? "h-5 w-5 items-center justify-center rounded-full"
            : "h-6 w-6 items-center justify-center rounded-full"
        }
        style={{ backgroundColor: categoryColor }}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <DynamicCategoryIcon
          name={iconName}
          size={compact ? UI_ICON_SIZE.mini : UI_ICON_SIZE.small}
          color={getReadableTextColor(categoryColor)}
        />
      </View>
      <Text
        className="shrink text-foreground"
        style={{
          fontWeight: isSelected ? UI_FONT_WEIGHT.bold : UI_FONT_WEIGHT.normal,
          color: visual.textColor,
          fontSize: UI_FONT_SIZE.label,
        }}
      >
        {displayLabel}
      </Text>
      {isSelected ? <Check size={UI_ICON_SIZE.mini} color={visual.textColor} /> : null}
    </>
  )
  const surfaceStyle = {
    backgroundColor: visual.backgroundColor,
    borderColor: visual.borderColor,
    borderWidth: UI_BORDER_WIDTH.thin,
  }
  return compact ? (
    <CompactControl
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? displayLabel}
      accessibilityState={{ selected: isSelected }}
      surfaceStyle={surfaceStyle}
    >
      {content}
    </CompactControl>
  ) : (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? displayLabel}
      accessibilityState={{ selected: isSelected }}
      className="min-h-12 max-w-full flex-row items-center gap-2 rounded-chip p-3 active:opacity-60"
      style={surfaceStyle}
    >
      {content}
    </Pressable>
  )
})

export type { CategoryCardProps }
