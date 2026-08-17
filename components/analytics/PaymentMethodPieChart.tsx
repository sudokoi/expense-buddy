import { useMemo, useCallback, memo } from "react"
import { Dimensions, Pressable, Text, View, useColorScheme } from "react-native"
import { PieChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import type { PaymentMethodChartDataItem } from "../../utils/analytics/aggregations"
import { getChartColors } from "../../constants/theme-colors"
import { PaymentMethodType } from "../../types/expense"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { useTranslation } from "react-i18next"
import { UI_OPACITY } from "../../constants/ui-tokens"

interface PaymentMethodPieChartProps {
  data: PaymentMethodChartDataItem[]
  selectedPaymentMethod: PaymentMethodType | null
  onPaymentMethodSelect: (paymentMethodType: PaymentMethodType | null) => void
}

// Memoized legend item component
const LegendItem = memo(function LegendItem({
  item,
  isSelected,
  selectedBgColor,
  onPress,
}: {
  item: PaymentMethodChartDataItem
  isSelected: boolean
  selectedBgColor: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${item.text}, ${item.percentage.toFixed(1)}%, ₹${item.value.toFixed(2)}`}
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
          <Text className="font-bold text-foreground">₹{item.value.toFixed(2)}</Text>
        </View>
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
  selectedPaymentMethod,
  onPaymentMethodSelect,
}: PaymentMethodPieChartProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const screenWidth = Dimensions.get("window").width
  const chartSize = Math.min(screenWidth - 80, 200)
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light"
  const chartColors = getChartColors(colorScheme)

  const handleSegmentPress = useCallback(
    (paymentMethodType: PaymentMethodType) => {
      const newSelection =
        selectedPaymentMethod === paymentMethodType ? null : paymentMethodType
      onPaymentMethodSelect(newSelection)
    },
    [selectedPaymentMethod, onPaymentMethodSelect]
  )

  // Memoize chart data transformation
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        value: item.value,
        color: item.color,
        text: `${item.percentage.toFixed(0)}%`,
        focused: selectedPaymentMethod === item.paymentMethodType,
        onPress: () => handleSegmentPress(item.paymentMethodType as PaymentMethodType),
      })),
    [data, selectedPaymentMethod, handleSegmentPress]
  )

  // Memoize total calculation
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  // Memoize center label component
  const CenterLabel = useCallback(
    () => (
      <View className="items-center">
        <Text className="text-xs text-foreground" style={{ opacity: UI_OPACITY.subtle }}>
          {t("analytics.charts.common.total")}
        </Text>
        <Text className="text-sm font-bold text-foreground">₹{total.toFixed(0)}</Text>
      </View>
    ),
    [total, t]
  )

  if (data.length === 0) {
    return (
      <CollapsibleSection title={t("analytics.charts.paymentMethod.title")}>
        <View className="h-[150px] items-center justify-center">
          <Text className="text-foreground" style={{ opacity: UI_OPACITY.subtle }}>
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
            showText
            textColor="white"
            textSize={10}
          />
        </View>

        <View className="w-full gap-2">
          {data.map((item) => (
            <LegendItem
              key={item.paymentMethodType}
              item={item}
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
