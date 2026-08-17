import { Pressable, Text } from "react-native"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { resolveCategoryColor } from "../../utils/resolve-category-color"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { UI_FONT_WEIGHT, UI_BORDER_WIDTH } from "../../constants/ui-tokens"

interface CategoryCardProps {
  isSelected: boolean
  categoryColor: string
  label: string
  onPress: () => void
  compact?: boolean
  accessibilityLabel?: string
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
}: CategoryCardProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const { resolvedColor, iconColor: selectedTextColor } =
    resolveCategoryColor(categoryColor)

  const displayLabel = label === "Other" ? t("settings.categories.other") : label

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? displayLabel}
      className={
        compact
          ? "w-[22%] items-center justify-center rounded-control p-2"
          : "w-[30%] items-center justify-center rounded-chip p-3"
      }
      style={{
        backgroundColor: isSelected ? resolvedColor : theme.background,
        borderColor: isSelected ? resolvedColor : theme.border,
        borderWidth: isSelected ? UI_BORDER_WIDTH.normal : UI_BORDER_WIDTH.thin,
      }}
    >
      <Text
        className="text-foreground"
        style={{
          fontWeight: isSelected ? UI_FONT_WEIGHT.bold : UI_FONT_WEIGHT.normal,
          color: isSelected ? selectedTextColor : theme.foreground,
          fontSize: compact ? 11 : 13,
        }}
        numberOfLines={1}
      >
        {displayLabel}
      </Text>
    </Pressable>
  )
})

export type { CategoryCardProps }
