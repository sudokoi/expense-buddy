import { useState, useMemo, useCallback, memo } from "react"
import { Pressable, Text, View, useWindowDimensions } from "react-native"
import { PieChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import type { PieChartDataItem } from "../../utils/analytics/aggregations"
import { getChartColors } from "../../constants/palette"
import { useThemeColors, useThemeScheme } from "../../hooks/use-theme-colors"
import { useTranslation } from "react-i18next"
import { formatCurrency } from "../../utils/currency"
import { UI_OPACITY } from "../../constants/ui-tokens"

interface PieChartSectionProps {
  data: PieChartDataItem[]
  currencyCode?: string
  onCategorySelect?: (category: string | null) => void
}

// Memoized legend item component
const LegendItem = memo(function LegendItem({
  item,
  currencyCode,
  isSelected,
  selectedBgColor,
  onPress,
}: {
  item: PieChartDataItem
  currencyCode: string
  isSelected: boolean
  selectedBgColor: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${item.text}, ${item.percentage.toFixed(1)}%, ${formatCurrency(item.value, currencyCode)}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View
        className="flex-row items-center justify-between rounded-control p-2"
        style={isSelected ? { backgroundColor: selectedBgColor } : undefined}
      >
        <View className="flex-row items-center gap-2">
          <View
            className="h-3 w-3 rounded-control"
            style={{ backgroundColor: item.color }}
          />
          <Text className={`${isSelected ? "font-bold" : "font-normal"} text-foreground`}>
            {item.text}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground" style={{ opacity: UI_OPACITY.subtle }}>
            {item.percentage.toFixed(1)}%
          </Text>
          <Text className="font-bold text-foreground">
            {formatCurrency(item.value, currencyCode)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
})

/**
 * PieChartSection - Pie chart with legend showing expense distribution by category
 * Wrapped in CollapsibleSection, supports tap to highlight category
 */
export const PieChartSection = memo(function PieChartSection({
  data,
  currencyCode = "INR",
  onCategorySelect,
}: PieChartSectionProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const { width: screenWidth } = useWindowDimensions()
  const chartSize = Math.min(screenWidth - 80, 200)
  const colorScheme = useThemeScheme()
  const chartColors = getChartColors(colorScheme)

  const handleSegmentPress = useCallback(
    (category: string) => {
      const newSelection = selectedCategory === category ? null : category
      setSelectedCategory(newSelection)
      onCategorySelect?.(newSelection)
    },
    [selectedCategory, onCategorySelect]
  )

  // Center text radially in the ring (between innerRadius and radius).
  // `outward` default is at 0.75R, but the ring centre is (R+innerR)/2 ≈ 0.83R,
  // so labels sit ~R/12 too close to the hole and the `%` gets covered by the
  // library's inner-circle View on the left side (see screenshot).
  const chartData = useMemo(() => {
    const totalValue = data.reduce((sum, d) => sum + d.value, 0)
    const delta = chartSize / 24 // R/12: distance from `outward` (0.75R) to ring centre (0.83R)
    return data.map((item, index) => {
      const prevTotal = data.slice(0, index).reduce((sum, d) => sum + d.value, 0)
      const midFraction = (prevTotal + item.value / 2) / totalValue
      const angle = 2 * Math.PI * midFraction
      return {
        value: item.value,
        color: item.color,
        text: `${item.percentage.toFixed(0)}%`,
        focused: selectedCategory === item.category,
        shiftTextX: delta * Math.sin(angle),
        shiftTextY: -delta * Math.cos(angle),
        onPress: () => handleSegmentPress(item.category),
      }
    })
  }, [data, selectedCategory, handleSegmentPress, chartSize])

  // Memoize total calculation
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  // Memoize center label component
  const CenterLabel = useCallback(
    () => (
      <View className="items-center">
        <Text className="text-xs text-foreground" style={{ opacity: UI_OPACITY.subtle }}>
          {t("analytics.charts.common.total")}
        </Text>
        <Text className="text-sm font-bold text-foreground">
          {formatCurrency(total, currencyCode)}
        </Text>
      </View>
    ),
    [total, t, currencyCode]
  )

  if (data.length === 0) {
    return (
      <CollapsibleSection title={t("analytics.charts.category.title")}>
        <View className="h-[150px] items-center justify-center">
          <Text className="text-foreground" style={{ opacity: UI_OPACITY.subtle }}>
            {t("analytics.charts.common.noData")}
          </Text>
        </View>
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection title={t("analytics.charts.category.title")}>
      <View className="items-center gap-4">
        <View>
          <PieChart
            data={chartData}
            donut
            radius={chartSize / 2}
            innerRadius={chartSize / 3}
            innerCircleColor={theme.background}
            centerLabelComponent={CenterLabel}
            focusOnPress
            showText
            textColor="white"
            textSize={10}
          />
        </View>

        <View className="w-full gap-2">
          {data.map((item) => (
            <LegendItem
              key={item.category}
              item={item}
              currencyCode={currencyCode}
              isSelected={selectedCategory === item.category}
              selectedBgColor={chartColors.selectedBg}
              onPress={() => handleSegmentPress(item.category)}
            />
          ))}
        </View>
      </View>
    </CollapsibleSection>
  )
})

export type { PieChartSectionProps }
