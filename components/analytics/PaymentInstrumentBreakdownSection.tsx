import { memo, useMemo } from "react"
import { YStack, XStack, Text, View } from "tamagui"
import { ViewStyle } from "react-native"
import { CollapsibleSection } from "./CollapsibleSection"
import type { PaymentInstrumentChartDataItem } from "../../utils/analytics-calculations"

interface PaymentInstrumentBreakdownSectionProps {
  data: PaymentInstrumentChartDataItem[]
}

const styles = {
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 120,
  } as ViewStyle,
  row: {
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  } as ViewStyle,
  left: {
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  } as ViewStyle,
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  } as ViewStyle,
  right: {
    alignItems: "flex-end",
    gap: 2,
  } as ViewStyle,
}

/**
 * Simple per-instrument breakdown list.
 * Shows totals for Credit/Debit/UPI instruments (including "Others").
 */
export const PaymentInstrumentBreakdownSection = memo(
  function PaymentInstrumentBreakdownSection({
    data,
  }: PaymentInstrumentBreakdownSectionProps) {
    const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

    if (data.length === 0) {
      return (
        <CollapsibleSection title="Spending by Payment Instrument">
          <YStack style={styles.emptyContainer}>
            <Text color="$color" opacity={0.6}>
              No card/UPI expenses for this period
            </Text>
          </YStack>
        </CollapsibleSection>
      )
    }

    return (
      <CollapsibleSection title="Spending by Payment Instrument">
        <YStack gap="$2">
          <XStack style={styles.row}>
            <Text color="$color" opacity={0.6}>
              Total
            </Text>
            <Text fontWeight="bold">₹{total.toFixed(0)}</Text>
          </XStack>

          <YStack>
            {data.map((item) => (
              <XStack key={item.key} style={styles.row}>
                <XStack style={styles.left}>
                  <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                  <Text numberOfLines={1} ellipsizeMode="tail">
                    {item.text}
                  </Text>
                </XStack>

                <YStack style={styles.right}>
                  <Text color="$color" opacity={0.6}>
                    {item.percentage.toFixed(1)}%
                  </Text>
                  <Text fontWeight="bold">₹{item.value.toFixed(2)}</Text>
                </YStack>
              </XStack>
            ))}
          </YStack>
        </YStack>
      </CollapsibleSection>
    )
  }
)

export type { PaymentInstrumentBreakdownSectionProps }
