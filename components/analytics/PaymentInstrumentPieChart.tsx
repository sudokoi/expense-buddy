import { useMemo, useCallback, memo } from "react"
import { useWindowDimensions, Pressable, Text, View } from "react-native"
import { PieChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import type { PaymentInstrumentChartDataItem } from "../../utils/analytics/aggregations"
import type { PaymentInstrumentSelectionKey } from "../../utils/analytics/filters"
import type { PaymentInstrumentMethod } from "../../types/payment-instrument"
import { getChartColors } from "../../constants/palette"
import { useThemeColors, useThemeScheme } from "../../hooks/use-theme-colors"
import { useTranslation } from "react-i18next"
import { formatCurrency } from "../../utils/currency"
import { UI_OPACITY } from "../../constants/ui-tokens"

interface PaymentInstrumentPieChartProps {
  data: PaymentInstrumentChartDataItem[]
  currencyCode?: string
  selectedKey?: PaymentInstrumentSelectionKey | null
  selectedKeys?: PaymentInstrumentSelectionKey[]
  onSelect?: (key: PaymentInstrumentSelectionKey | null) => void
  onMethodSelect?: (method: PaymentInstrumentMethod) => void
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
      accessibilityRole="button"
      accessibilityLabel={`${item.text}, ${item.percentage.toFixed(1)}%, ${formatCurrency(item.value, currencyCode)}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View
        className="min-h-12 flex-row flex-wrap items-center justify-between gap-2 rounded-control p-2"
        style={isSelected ? { backgroundColor: selectedBgColor } : undefined}
      >
        <View className="min-w-[100px] flex-1 flex-row items-center gap-2">
          <View
            className="h-3 w-3 rounded-control"
            style={{ backgroundColor: item.color }}
          />
          <Text
            className={`shrink flex-wrap ${
              isSelected ? "font-bold" : "font-normal"
            } text-sm text-foreground`}
          >
            {item.text}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Text className="text-xs text-muted-foreground">
            {item.percentage.toFixed(1)}%
          </Text>
          <Text className="text-sm font-bold text-foreground">
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
  selectedKeys,
  onSelect,
  onMethodSelect,
}: PaymentInstrumentPieChartProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const { width: screenWidth } = useWindowDimensions()
  const chartSize = Math.min(screenWidth - 80, 200)
  const colorScheme = useThemeScheme()
  const chartColors = getChartColors(colorScheme)

  // Effective selected keys for highlight (supports both single and multi)
  const effectiveSelectedKeys = useMemo(
    () => selectedKeys ?? (selectedKey ? [selectedKey] : []),
    [selectedKeys, selectedKey]
  )

  const handleSegmentPress = useCallback(
    (key: PaymentInstrumentSelectionKey) => {
      const next = selectedKey === key ? null : key
      onSelect?.(next)
    },
    [selectedKey, onSelect]
  )

  const handleMethodPress = useCallback(
    (method: PaymentInstrumentMethod) => {
      onMethodSelect?.(method)
    },
    [onMethodSelect]
  )

  // Chart slices are aggregated by payment method (CC/DC/UPI) for distinct
  // colors — individual cards share the same method color and would otherwise
  // be indistinguishable as separate slices. Legend below still shows per-card
  // breakdown (with CC/DC short labels).
  const chartData = useMemo(() => {
    if (data.length === 0) return []
    const totalValue = data.reduce((sum, d) => sum + d.value, 0)
    if (totalValue === 0) return []

    // Group instrument totals by method for the pie
    const grouped = new Map<string, { value: number; color: string }>()
    for (const item of data) {
      const existing = grouped.get(item.method)
      if (existing) {
        existing.value += item.value
      } else {
        grouped.set(item.method, { value: item.value, color: item.color })
      }
    }

    const methodEntries = Array.from(grouped.entries()).map(([method, entry]) => ({
      method,
      value: entry.value,
      color: entry.color,
      percentage: (entry.value / totalValue) * 100,
    }))

    const delta = chartSize / 24 // R/12: centre between outward (0.75R) and ring centre (0.83R)
    return methodEntries.map((entry, index) => {
      const prevTotal = methodEntries.slice(0, index).reduce((sum, e) => sum + e.value, 0)
      const midFraction = (prevTotal + entry.value / 2) / totalValue
      const angle = 2 * Math.PI * midFraction
      const isFocused = effectiveSelectedKeys.some((k) =>
        k.startsWith(`${entry.method}::`)
      )
      return {
        value: entry.value,
        color: entry.color,
        text: `${entry.percentage.toFixed(0)}%`,
        focused: isFocused,
        shiftTextX: delta * Math.sin(angle),
        shiftTextY: -delta * Math.cos(angle),
        onPress: () => handleMethodPress(entry.method as PaymentInstrumentMethod),
      }
    })
  }, [data, effectiveSelectedKeys, handleMethodPress, chartSize])

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
            showText={false}
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
              isSelected={effectiveSelectedKeys.includes(item.key)}
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
