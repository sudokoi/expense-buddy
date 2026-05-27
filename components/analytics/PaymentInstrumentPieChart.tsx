import { useMemo, useCallback, memo } from "react"
import { YStack, XStack, Text, View } from "tamagui"
import { PieChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import type { PaymentInstrumentChartDataItem } from "../../utils/analytics/aggregations"
import type { PaymentInstrumentSelectionKey } from "../../utils/analytics/filters"
import { Dimensions, ViewStyle, Pressable, useColorScheme } from "react-native"
import { getChartColors } from "../../constants/theme-colors"
import { useTranslation } from "react-i18next"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
} from "../../constants/ui-tokens"

interface PaymentInstrumentPieChartProps {
  data: PaymentInstrumentChartDataItem[]
  selectedKey?: PaymentInstrumentSelectionKey | null
  onSelect?: (key: PaymentInstrumentSelectionKey | null) => void
}

const LegendItem = memo(function LegendItem({
  item,
  isSelected,
  selectedBgColor,
  onPress,
}: {
  item: PaymentInstrumentChartDataItem
  isSelected: boolean
  selectedBgColor: string
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        justify="space-between"
        items="center"
        p={UI_SPACE.control}
        rounded={UI_RADIUS.control}
        style={isSelected ? { backgroundColor: selectedBgColor } : undefined}
      >
        <XStack items="flex-start" gap={UI_SPACE.control} grow={1} shrink={1} minW={0}>
          <View width={12} height={12} rounded={UI_RADIUS.control} style={{ backgroundColor: item.color }} />
          <Text
            fontWeight={isSelected ? UI_FONT_WEIGHT.bold : UI_FONT_WEIGHT.normal}
            shrink={1}
            flexWrap="wrap"
          >
            {item.text}
          </Text>
        </XStack>
        <XStack gap={UI_SPACE.control} items="center" shrink={0}>
          <Text color="$color" opacity={UI_OPACITY.subtle}>
            {item.percentage.toFixed(1)}%
          </Text>
          <Text fontWeight={UI_FONT_WEIGHT.bold}>₹{item.value.toFixed(2)}</Text>
        </XStack>
      </XStack>
    </Pressable>
  )
})

/**
 * PaymentInstrumentPieChart - Pie chart with legend showing expense distribution by saved card/UPI instruments.
 * Includes an "Others" bucket per method for missing/deleted instruments.
 */
export const PaymentInstrumentPieChart = memo(function PaymentInstrumentPieChart({
  data,
  selectedKey = null,
  onSelect,
}: PaymentInstrumentPieChartProps) {
  const { t } = useTranslation()
  const screenWidth = Dimensions.get("window").width
  const chartSize = Math.min(screenWidth - 80, 200)
  const colorScheme = useColorScheme() ?? "light"
  const chartColors = getChartColors(colorScheme)

  const handleSegmentPress = useCallback(
    (key: PaymentInstrumentSelectionKey) => {
      const next = selectedKey === key ? null : key
      onSelect?.(next)
    },
    [selectedKey, onSelect]
  )

  const chartData = useMemo(
    () =>
      data.map((item) => ({
        value: item.value,
        color: item.color,
        text: `${item.percentage.toFixed(0)}%`,
        focused: selectedKey === item.key,
        onPress: () => handleSegmentPress(item.key),
      })),
    [data, selectedKey, handleSegmentPress]
  )

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  const CenterLabel = useCallback(
    () => (
      <YStack items="center">
        <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.subtle}>
          {t("analytics.charts.common.total")}
        </Text>
        <Text fontWeight={UI_FONT_WEIGHT.bold} fontSize="$label">
          ₹{total.toFixed(0)}
        </Text>
      </YStack>
    ),
    [total, t]
  )

  if (data.length === 0) {
    return (
      <CollapsibleSection title={t("analytics.charts.paymentInstrument.title")}>
        <YStack items="center" justify="center" height={150}>
          <Text color="$color" opacity={UI_OPACITY.subtle}>
            {t("analytics.charts.paymentInstrument.noData")}
          </Text>
        </YStack>
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection title={t("analytics.charts.paymentInstrument.title")}>
      <YStack items="center" gap={UI_SPACE.gutter}>
        <View>
          <PieChart
            data={chartData}
            donut
            radius={chartSize / 2}
            innerRadius={chartSize / 3}
            innerCircleColor="$background"
            centerLabelComponent={CenterLabel}
            focusOnPress
            showText
            textColor="white"
            textSize={10}
          />
        </View>

        <YStack width="100%" gap="$control">
          {data.map((item) => (
            <LegendItem
              key={item.key}
              item={item}
              isSelected={selectedKey === item.key}
              selectedBgColor={chartColors.selectedBg}
              onPress={() => handleSegmentPress(item.key)}
            />
          ))}
        </YStack>
      </YStack>
    </CollapsibleSection>
  )
})

export type { PaymentInstrumentPieChartProps }
