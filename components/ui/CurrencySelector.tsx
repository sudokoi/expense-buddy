import { Text, Card, View, useTheme } from "tamagui"
import { DollarSign, IndianRupee, PoundSterling, Euro, JapaneseYen } from "@tamagui/lucide-icons"
import { Pressable, ViewStyle } from "react-native"
import { getColorValue } from "../../tamagui.config"

interface CurrencySelectorProps {
  value: string
  onChange: (currency: string) => void
}

// Only use style prop for layout properties that Tamagui View doesn't support directly
const styles = {
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
  } as ViewStyle,
  segment: {
    flexBasis: "25%", // 4 items per row
    minHeight: 44,
  } as ViewStyle,
  segmentInner: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 8,
    borderRadius: 8,
    margin: 2,
  } as ViewStyle,
}

const ICON_SIZE = 18

interface CurrencyOption {
  key: string
  label: string
  Icon: React.ComponentType<any>
}

const currencyOptions: CurrencyOption[] = [
  { key: "INR", label: "INR", Icon: IndianRupee },
  { key: "USD", label: "USD", Icon: DollarSign },
  { key: "GBP", label: "GBP", Icon: PoundSterling },
  { key: "EUR", label: "EUR", Icon: Euro },
  { key: "JPY", label: "JPY", Icon: JapaneseYen },
]

export function CurrencySelector({ value, onChange }: CurrencySelectorProps) {
  const theme = useTheme()

  return (
    <Card bordered padding="$1" borderRadius="$4" style={styles.container}>
      {currencyOptions.map(({ key, label, Icon }) => {
        const isSelected = value === key
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Select ${label}`}
            style={({ pressed }) => [styles.segment, { opacity: pressed ? 0.8 : 1 }]}
          >
            <View
              flex={1}
              borderWidth={2}
              bg={isSelected ? "$backgroundFocus" : "transparent"}
              borderColor={
                isSelected ? getColorValue(theme.borderColorFocus) : "transparent"
              }
              style={styles.segmentInner}
            >
              <Icon
                size={ICON_SIZE}
                color={getColorValue(theme.color)}
                opacity={isSelected ? 1 : 0.7}
              />
              <Text
                fontSize="$2"
                fontWeight={isSelected ? "600" : "400"}
                color="$color"
                opacity={isSelected ? 1 : 0.7}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        )
      })}
    </Card>
  )
}
