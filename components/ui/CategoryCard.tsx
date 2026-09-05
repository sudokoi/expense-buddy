import { Pressable, Text, View } from "react-native"
import { Check } from "lucide-react-native"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { getReadableTextColor } from "../../constants/palette"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { UI_FONT_SIZE, UI_FONT_WEIGHT, UI_BORDER_WIDTH } from "../../constants/ui-tokens"

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

  const displayLabel = label === "Other" ? t("settings.categories.other") : label

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? displayLabel}
      accessibilityState={{ selected: isSelected }}
      className={
        compact
          ? "min-h-12 max-w-full flex-row items-center gap-2 rounded-control px-3 py-2 active:opacity-60"
          : "min-h-12 max-w-full flex-row items-center gap-2 rounded-chip p-3 active:opacity-60"
      }
      style={{
        backgroundColor: isSelected ? theme.accent : theme.surface,
        borderColor: isSelected ? theme.accent : theme.border,
        borderWidth: UI_BORDER_WIDTH.thin,
      }}
    >
      {isSelected ? (
        <Check size={16} color={theme.accentForeground} />
      ) : (
        <View
          className="h-6 w-6 items-center justify-center rounded-full"
          style={{ backgroundColor: categoryColor }}
        >
          <DynamicCategoryIcon
            name={iconName}
            size={14}
            color={getReadableTextColor(categoryColor)}
          />
        </View>
      )}
      <Text
        className="shrink text-foreground"
        style={{
          fontWeight: isSelected ? UI_FONT_WEIGHT.bold : UI_FONT_WEIGHT.normal,
          color: isSelected ? theme.accentForeground : theme.foreground,
          fontSize: UI_FONT_SIZE.label,
        }}
      >
        {displayLabel}
      </Text>
    </Pressable>
  )
})

export type { CategoryCardProps }
