import { useMemo, useCallback, memo } from "react"
import { YStack, XStack, Text, View } from "tamagui"
import { PieChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import type {
  PaymentInstrumentChartDataItem,
  PaymentInstrumentSelectionKey,
} from "../../utils/analytics-calculations"
import { Dimensions, ViewStyle, Pressable, useColorScheme } from "react-native"
import { getChartColors } from "../../constants/theme-colors"
import { useTranslation } from "react-i18next"

interface PaymentInstrumentPieChartProps {
  data: PaymentInstrumentChartDataItem[]
  selectedKey?: PaymentInstrumentSelectionKey | null
  onSelect?: (key: PaymentInstrumentSelectionKey | null) => void
}

const styles = {
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 150,
  } as ViewStyle,
  chartContainer: {
    alignItems: "center",
    gap: 16,
  } as ViewStyle,
  centerLabel: {
    alignItems: "center",
  } as ViewStyle,
  legendRow: {
    justifyContent: "space-between",
    alignItems: "center",
    padding: 8,
    borderRadius: 4,
  } as ViewStyle,
  legendLeft: {
    alignItems: "center",
    gap: 8,
  } as ViewStyle,
  legendRight: {
    gap: 8,
    alignItems: "center",
  } as ViewStyle,
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  } as ViewStyle,
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
        style={[
          styles.legendRow,
          isSelected ? { backgroundColor: selectedBgColor } : undefined,
        ]}
      >
        <XStack style={styles.legendLeft}>
          <View style={[styles.colorDot, { backgroundColor: item.color }]} />
          <Text fontWeight={isSelected ? "bold" : "normal"} numberOfLines={1}>
            {item.text}
          </Text>
        </XStack>
        <XStack style={styles.legendRight}>
          <Text color="$color" opacity={0.6}>
            {item.percentage.toFixed(1)}%
          </Text>
          <Text fontWeight="bold">₹{item.value.toFixed(2)}</Text>
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
      <YStack style={styles.centerLabel}>
        <Text fontSize="$2" color="$color" opacity={0.6}>
          {t("analytics.charts.common.total")}
        </Text>
        <Text fontWeight="bold" fontSize="$4">
          ₹{total.toFixed(0)}
        </Text>
      </YStack>
    ),
    [total, t]
  )

  if (data.length === 0) {
    return (
      <CollapsibleSection title={t("analytics.charts.paymentInstrument.title")}>
        <YStack style={styles.emptyContainer}>
          <Text color="$color" opacity={0.6}>
            {t("analytics.charts.paymentInstrument.noData")}
          </Text>
        </YStack>
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection title={t("analytics.charts.paymentInstrument.title")}>
      <YStack style={styles.chartContainer}>
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

        <YStack width="100%" gap="$2">
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
