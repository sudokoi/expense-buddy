import type { ReactNode, ComponentType } from "react"
import { memo } from "react"
import { ScrollView, View } from "react-native"
import { Button } from "../ui/Button"
import { Check } from "lucide-react-native"

/**
 * Shared filter chip layout and selection styling. Wrap choices so they remain
 * discoverable; opt into horizontal scrolling for open-ended month lists.
 */

interface FilterChipBarProps {
  children: ReactNode
  horizontal?: boolean
}

export const FilterChipBar = memo(function FilterChipBar({
  children,
  horizontal = false,
}: FilterChipBarProps) {
  if (!horizontal) return <View className="flex-row flex-wrap gap-2">{children}</View>
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      contentContainerStyle={{ paddingBottom: 8 }}
    >
      <View className="flex-row gap-2">{children}</View>
    </ScrollView>
  )
})

interface FilterChipProps {
  label: string
  selected: boolean
  onPress: () => void
  Icon?: ComponentType<{ size?: number }>
  iconSize?: number
}

export const FilterChip = memo(function FilterChip({
  label,
  selected,
  onPress,
  Icon,
  iconSize = 14,
}: FilterChipProps) {
  return (
    <Button
      size="compact"
      variant={selected ? "accent" : "outline"}
      icon={
        selected ? <Check size={iconSize} /> : Icon ? <Icon size={iconSize} /> : undefined
      }
      onPress={onPress}
      accessibilityState={{ selected }}
    >
      {label}
    </Button>
  )
})
