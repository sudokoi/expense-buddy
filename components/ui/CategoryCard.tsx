import { Card, Text } from "tamagui"
import { memo, useMemo } from "react"
import { getColorValue } from "../../tamagui.config"
import { getReadableTextColor } from "../../constants/theme-colors"

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
  // Memoize color computation to avoid recalculating on every render
  const resolvedColor = useMemo(() => getColorValue(categoryColor), [categoryColor])
  const selectedTextColor = useMemo(
    () => getReadableTextColor(resolvedColor),
    [resolvedColor]
  )

  return (
    <Card
      bordered
      backgroundColor={isSelected ? resolvedColor : "$background"}
      borderColor={isSelected ? resolvedColor : "$borderColor"}
      padding={compact ? "$2" : "$3"}
      borderRadius={compact ? "$3" : "$4"}
      width={compact ? "22%" : "30%"}
      alignItems="center"
      justifyContent="center"
      onPress={onPress}
    >
      <Text
        fontWeight={isSelected ? "bold" : "normal"}
        color={isSelected ? selectedTextColor : "$color"}
        fontSize={compact ? "$1" : "$3"}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Card>
  )
})

export type { CategoryCardProps }
