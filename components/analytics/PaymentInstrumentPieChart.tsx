import { useMemo, useCallback, memo } from "react"
import { Dimensions, Pressable, Text, View } from "react-native"
import { PieChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import type { PaymentInstrumentChartDataItem } from "../../utils/analytics/aggregations"
import type { PaymentInstrumentSelectionKey } from "../../utils/analytics/filters"
import { getChartColors } from "../../constants/palette"
import { useThemeColors, useThemeScheme } from "../../hooks/use-theme-colors"
import { useTranslation } from "react-i18next"
import { formatCurrency } from "../../utils/currency"
import { UI_OPACITY } from "../../constants/ui-tokens"

interface PaymentInstrumentPieChartProps {
  data: PaymentInstrumentChartDataItem[]
  currencyCode?: string
  selectedKey?: PaymentInstrumentSelectionKey | null
  onSelect?: (key: PaymentInstrumentSelectionKey | null) => void
}

const LegendItem = memo(function LegendItem({
  item,
  currencyCode,
  isSelected,
  selectedBgColor,
  onPress,
}: {
  item: PaymentInstrumentChartDataItem
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
        <View className="min-w-0 grow flex-row items-start gap-2">
          <View
            className="h-3 w-3 rounded-control"
            style={{ backgroundColor: item.color }}
          />
          <Text
            className={`shrink flex-wrap ${
              isSelected ? "font-bold" : "font-normal"
            } text-foreground`}
          >
            {item.text}
          </Text>
        </View>
        <View className="shrink-0 flex-row items-center gap-2">
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
 * PaymentInstrumentPieChart - Pie chart with legend showing expense distribution by saved card/UPI instruments.
 * Includes an "Others" bucket per method for missing/deleted instruments.
 */
export const PaymentInstrumentPieChart = memo(function PaymentInstrumentPieChart({
  data,
  currencyCode = "INR",
  selectedKey = null,
  onSelect,
}: PaymentInstrumentPieChartProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const screenWidth = Dimensions.get("window").width
  const chartSize = Math.min(screenWidth - 80, 200)
  const colorScheme = useThemeScheme()
  const chartColors = getChartColors(colorScheme)

  const handleSegmentPress = useCallback(
    (key: PaymentInstrumentSelectionKey) => {
      const next = selectedKey === key ? null : key
      onSelect?.(next)
    },
    [selectedKey, onSelect]
  )

  // Center text radially in the ring (between innerRadius and radius).
  const chartData = useMemo(() => {
    const totalValue = data.reduce((sum, d) => sum + d.value, 0)
    const delta = chartSize / 24 // R/12
    return data.map((item, index) => {
      const prevTotal = data.slice(0, index).reduce((sum, d) => sum + d.value, 0)
      const midFraction = (prevTotal + item.value / 2) / totalValue
      const angle = 2 * Math.PI * midFraction
      return {
        value: item.value,
        color: item.color,
        text: `${item.percentage.toFixed(0)}%`,
        focused: selectedKey === item.key,
        shiftTextX: delta * Math.sin(angle),
        shiftTextY: -delta * Math.cos(angle),
        onPress: () => handleSegmentPress(item.key),
      }
    })
  }, [data, selectedKey, handleSegmentPress, chartSize])

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

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
      <CollapsibleSection title={t("analytics.charts.paymentInstrument.title")}>
        <View className="h-[150px] items-center justify-center">
          <Text className="text-foreground" style={{ opacity: UI_OPACITY.subtle }}>
            {t("analytics.charts.paymentInstrument.noData")}
          </Text>
        </View>
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection title={t("analytics.charts.paymentInstrument.title")}>
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
              key={item.key}
              item={item}
              currencyCode={currencyCode}
              isSelected={selectedKey === item.key}
              selectedBgColor={chartColors.selectedBg}
              onPress={() => handleSegmentPress(item.key)}
            />
          ))}
        </View>
      </View>
    </CollapsibleSection>
  )
})

export type { PaymentInstrumentPieChartProps }
