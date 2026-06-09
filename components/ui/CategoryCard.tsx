import { Card, Text } from "tamagui"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { useResolvedCategoryColor } from "../../hooks/use-resolved-category-color"
import { UI_FONT_WEIGHT, UI_BORDER_WIDTH } from "../../constants/ui-tokens"

interface CategoryCardProps {
  isSelected: boolean
  categoryColor: string
  label: string
  onPress: () => void
  compact?: boolean
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
}: CategoryCardProps) {
  const { t } = useTranslation()
  const { resolvedColor, iconColor: selectedTextColor } =
    useResolvedCategoryColor(categoryColor)

  const displayLabel = label === "Other" ? t("settings.categories.other") : label

  return (
    <Card
      bg={isSelected ? resolvedColor : "$background"}
      borderColor={isSelected ? resolvedColor : "$borderColor"}
      borderWidth={isSelected ? UI_BORDER_WIDTH.normal : UI_BORDER_WIDTH.thin}
      p={compact ? "$control" : "$section"}
      rounded={compact ? "$control" : "$chip"}
      width={compact ? "22%" : "30%"}
      items="center"
      justify="center"
      onPress={onPress}
    >
      <Text
        fontWeight={isSelected ? UI_FONT_WEIGHT.bold : UI_FONT_WEIGHT.normal}
        color={isSelected ? selectedTextColor : "$color"}
        fontSize={compact ? "$micro" : "$body"}
        numberOfLines={1}
      >
        {displayLabel}
      </Text>
    </Card>
  )
})

export type { CategoryCardProps }
