import { Card, Text } from "tamagui"
import { ReactNode } from "react"
import { getColorValue } from "../../tamagui.config"

interface CategoryCardProps {
  isSelected: boolean
  categoryColor: string
  label: string
  onPress: () => void
  children?: ReactNode
}

/**
 * CategoryCard - A styled Card for category selection
 * Provides consistent styling for category selection cards with selected/unselected states
 */
export function CategoryCard({
  isSelected,
  categoryColor,
  label,
  onPress,
}: CategoryCardProps) {
  return (
    <Card
      bordered
      animation="bouncy"
      scale={0.97}
      hoverStyle={{ scale: 1 }}
      pressStyle={{ scale: 0.95 }}
      backgroundColor={isSelected ? getColorValue(categoryColor) : "$background"}
      borderColor={isSelected ? getColorValue(categoryColor) : "$borderColor"}
      padding="$3"
      borderRadius="$4"
      width="30%"
      alignItems="center"
      justifyContent="center"
      onPress={onPress}
    >
      <Text
        fontWeight={isSelected ? "bold" : "normal"}
        color={isSelected ? "#ffffff" : "$color"}
      >
        {label}
      </Text>
    </Card>
  )
}

export type { CategoryCardProps }
