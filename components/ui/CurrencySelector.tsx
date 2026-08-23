import { View, Text } from "react-native"
import {
  DollarSign,
  IndianRupee,
  PoundSterling,
  Euro,
  JapaneseYen,
  type LucideIcon,
} from "lucide-react-native"
import { Pressable } from "react-native"
import { Card } from "./Card"
import {
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
  UI_MIN_TOUCH_TARGET,
} from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"

interface CurrencySelectorProps {
  value: string
  onChange: (currency: string) => void
}

interface CurrencyOption {
  key: string
  label: string
  Icon: LucideIcon
}

const currencyOptions: CurrencyOption[] = [
  { key: "INR", label: "INR", Icon: IndianRupee },
  { key: "USD", label: "USD", Icon: DollarSign },
  { key: "GBP", label: "GBP", Icon: PoundSterling },
  { key: "EUR", label: "EUR", Icon: Euro },
  { key: "JPY", label: "JPY", Icon: JapaneseYen },
  { key: "CAD", label: "CAD", Icon: DollarSign },
  { key: "AUD", label: "AUD", Icon: DollarSign },
]

export function CurrencySelector({ value, onChange }: CurrencySelectorProps) {
  const theme = useThemeColors()

  return (
    <Card className="flex-row flex-wrap rounded-control p-1">
      {currencyOptions.map(({ key, label, Icon }) => {
        const isSelected = value === key
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            role="button"
            aria-selected={isSelected}
            aria-label={`Select ${label}`}
            style={({ pressed }) => [
              { flexBasis: "25%", minHeight: UI_MIN_TOUCH_TARGET },
              { opacity: pressed ? UI_OPACITY.subtle : 1 },
            ]}
          >
            <View
              className="items-center justify-center gap-1 rounded-control p-2"
              style={{
                borderWidth: UI_BORDER_WIDTH.normal,
                backgroundColor: isSelected ? theme.muted : "transparent",
                borderColor: isSelected ? theme.accent : "transparent",
                margin: UI_SPACE.micro / 2,
              }}
            >
              <Icon
                size={UI_ICON_SIZE.regular}
                color={theme.foreground}
                style={{ opacity: isSelected ? 1 : UI_OPACITY.medium }}
              />
              <Text
                className="text-xs text-foreground"
                style={{
                  fontWeight: isSelected
                    ? UI_FONT_WEIGHT.semiBold
                    : UI_FONT_WEIGHT.normal,
                  opacity: isSelected ? 1 : UI_OPACITY.medium,
                }}
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
