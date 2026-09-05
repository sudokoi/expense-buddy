import { useMemo, useCallback, memo } from "react"
import { useWindowDimensions, Pressable, Text, View } from "react-native"
import { PieChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import type { PaymentMethodChartDataItem } from "../../utils/analytics/aggregations"
import { getChartColors } from "../../constants/palette"
import { PaymentMethodType } from "../../types/expense"
import { useThemeColors, useThemeScheme } from "../../hooks/use-theme-colors"
import { useTranslation } from "react-i18next"
import { formatCurrency, formatPercentage } from "../../utils/currency"

interface PaymentMethodPieChartProps {
  data: PaymentMethodChartDataItem[]
  currencyCode?: string
  selectedPaymentMethod: PaymentMethodType | null
  onPaymentMethodSelect: (paymentMethodType: PaymentMethodType | null) => void
}

// Memoized legend item component
const LegendItem = memo(function LegendItem({
  item,
  currencyCode,
  isSelected,
  selectedBgColor,
  onPress,
}: {
  item: PaymentMethodChartDataItem
  currencyCode: string
  isSelected: boolean
  selectedBgColor: string
  onPress: () => void
}) {
  const { t } = useTranslation()
  const valueLabel = t("analytics.charts.common.amountWithPercentage", {
    amount: formatCurrency(item.value, currencyCode),
    percentage: formatPercentage(item.percentage),
  })
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.text}, ${valueLabel}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View
        className="min-h-12 flex-row flex-wrap items-center justify-between gap-2 rounded-control p-2"
        style={isSelected ? { backgroundColor: selectedBgColor } : undefined}
      >
        <View className="min-w-legend flex-1 flex-row items-center gap-2">
          <View
            className="h-3 w-3 rounded-control"
            style={{ backgroundColor: item.color }}
          />
          <Text
            className={`${isSelected ? "font-bold" : "font-normal"} flex-1 text-sm text-foreground`}
          >
            {item.text}
          </Text>
        </View>
        <Text className="max-w-full text-right text-sm font-semibold text-foreground">
          {valueLabel}
        </Text>
      </View>
    </Pressable>
  )
})

/**
 * PaymentMethodPieChart - Pie chart with legend showing expense distribution by payment method
 * Wrapped in CollapsibleSection, supports tap to highlight payment method
 */
export const PaymentMethodPieChart = memo(function PaymentMethodPieChart({
  data,
  currencyCode = "INR",
  selectedPaymentMethod,
  onPaymentMethodSelect,
}: PaymentMethodPieChartProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const { width: screenWidth } = useWindowDimensions()
  const chartSize = Math.min(screenWidth - 80, 200)
  const colorScheme = useThemeScheme()
  const chartColors = getChartColors(colorScheme)

  const handleSegmentPress = useCallback(
    (paymentMethodType: PaymentMethodType) => {
      const newSelection =
        selectedPaymentMethod === paymentMethodType ? null : paymentMethodType
      onPaymentMethodSelect(newSelection)
    },
    [selectedPaymentMethod, onPaymentMethodSelect]
  )

  // Center text radially in the ring (between innerRadius and radius).
  // `outward` default is at 0.75R, but the ring centre is (R+innerR)/2 ≈ 0.83R,
  // so labels sit ~R/12 too close to the hole and the `%` gets covered.
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
        focused: selectedPaymentMethod === item.paymentMethodType,
        shiftTextX: delta * Math.sin(angle),
        shiftTextY: -delta * Math.cos(angle),
        onPress: () => handleSegmentPress(item.paymentMethodType as PaymentMethodType),
      }
    })
  }, [data, selectedPaymentMethod, handleSegmentPress, chartSize])

  // Memoize total calculation
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  // Memoize center label component
  const CenterLabel = useCallback(
    () => (
      <View className="items-center">
        <Text className="text-xs text-muted-foreground">
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
      <CollapsibleSection title={t("analytics.charts.paymentMethod.title")}>
        <View className="h-chart-empty items-center justify-center">
          <Text className="text-muted-foreground">
            {t("analytics.charts.common.noData")}
          </Text>
        </View>
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection title={t("analytics.charts.paymentMethod.title")}>
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
          />
        </View>

        <View className="w-full gap-1">
          {data.map((item) => (
            <LegendItem
              key={item.paymentMethodType}
              item={item}
              currencyCode={currencyCode}
              isSelected={selectedPaymentMethod === item.paymentMethodType}
              selectedBgColor={chartColors.selectedBg}
              onPress={() =>
                handleSegmentPress(item.paymentMethodType as PaymentMethodType)
              }
            />
          ))}
        </View>
      </View>
    </CollapsibleSection>
  )
})

export type { PaymentMethodPieChartProps }
