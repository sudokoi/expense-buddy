import { Text, Card, View, useTheme } from "tamagui"
import {
  DollarSign,
  IndianRupee,
  PoundSterling,
  Euro,
  JapaneseYen,
} from "@tamagui/lucide-icons-2"
import { Pressable } from "react-native"
import { getColorValue } from "../../tamagui.config"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"

interface CurrencySelectorProps {
  value: string
  onChange: (currency: string) => void
}



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
    <Card
      borderWidth={UI_BORDER_WIDTH.thin}
      borderColor="$borderColor"
      p="$micro"
      rounded="$control"
      flexDirection="row" flexWrap="wrap"
    >
      {currencyOptions.map(({ key, label, Icon }) => {
        const isSelected = value === key
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            role="button"
            aria-selected={isSelected}
            aria-label={`Select ${label}`}
            style={({ pressed }) => [{ flexBasis: "25%", minHeight: 44 }, { opacity: pressed ? 0.8 : 1 }]}
          >
            <View
              flex={1}
              borderWidth={UI_BORDER_WIDTH.normal}
              bg={isSelected ? "$backgroundFocus" : "transparent"}
              borderColor={
                isSelected ? getColorValue(theme.borderColorFocus) : "transparent"
              }
              flexDirection="column" items="center" justify="center" gap={UI_SPACE.micro} p={UI_SPACE.control} rounded={UI_RADIUS.control} m={UI_SPACE.micro / 2}
            >
              <Icon
                size={UI_ICON_SIZE.regular}
                color={getColorValue(theme.color)}
                opacity={isSelected ? 1 : UI_OPACITY.medium}
              />
              <Text
                fontSize="$caption"
                fontWeight={isSelected ? UI_FONT_WEIGHT.semiBold : UI_FONT_WEIGHT.normal}
                color="$color"
                opacity={isSelected ? 1 : UI_OPACITY.medium}
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
