import type { ReactNode, ComponentType } from "react"
import { memo } from "react"
import { ScrollView, Text, View } from "react-native"
import { CompactControl } from "../ui/CompactControl"
import { Check } from "lucide-react-native"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { getReadableTextColor } from "../../constants/palette"
import { resolveCategoryVisual } from "../../utils/resolve-category-color"
import { UI_FONT_WEIGHT, UI_ICON_SIZE, UI_SPACE } from "../../constants/ui-tokens"

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
  if (!horizontal) return <View className="flex-row flex-wrap gap-x-2">{children}</View>
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      contentContainerStyle={{ paddingBottom: UI_SPACE.control }}
    >
      <View className="flex-row gap-2">{children}</View>
    </ScrollView>
  )
})

interface FilterChipProps {
  label: string
  selected: boolean
  onPress: () => void
  Icon?: ComponentType<{ size?: number; color?: string }>
  iconSize?: number
  categoryColor?: string
}

export const FilterChip = memo(function FilterChip({
  label,
  selected,
  onPress,
  Icon,
  iconSize = UI_ICON_SIZE.mini,
  categoryColor,
}: FilterChipProps) {
  const theme = useThemeColors()
  const visual = categoryColor
    ? resolveCategoryVisual(categoryColor, selected, theme)
    : {
        backgroundColor: selected ? theme.accent : theme.muted,
        borderColor: selected ? theme.accent : theme.border,
        textColor: selected ? theme.accentForeground : theme.foreground,
      }
  return (
    <CompactControl
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      surfaceStyle={{
        backgroundColor: visual.backgroundColor,
        borderColor: visual.borderColor,
      }}
    >
      {Icon ? (
        categoryColor ? (
          <View
            className="h-5 w-5 items-center justify-center rounded-full"
            style={{ backgroundColor: categoryColor }}
          >
            <Icon size={UI_ICON_SIZE.micro} color={getReadableTextColor(categoryColor)} />
          </View>
        ) : (
          <Icon size={iconSize} color={visual.textColor} />
        )
      ) : null}
      <Text
        className="shrink text-sm"
        style={{
          color: visual.textColor,
          fontWeight: selected ? UI_FONT_WEIGHT.semiBold : UI_FONT_WEIGHT.normal,
        }}
      >
        {label}
      </Text>
      {selected ? <Check size={UI_ICON_SIZE.micro} color={visual.textColor} /> : null}
    </CompactControl>
  )
})
