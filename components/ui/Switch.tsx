import { Switch as RNSwitch, type SwitchProps as RNSwitchProps } from "react-native"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { hapticLight } from "../../utils/haptics"

export interface SwitchProps extends Omit<RNSwitchProps, "value" | "onValueChange"> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  accessibilityLabel: string
}

export function Switch({
  checked,
  onCheckedChange,
  accessibilityLabel,
  ...props
}: SwitchProps) {
  const theme = useThemeColors()
  return (
    <RNSwitch
      value={checked}
      onValueChange={(next) => {
        void hapticLight()
        onCheckedChange(next)
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      trackColor={{ true: theme.accent, false: theme.border }}
      thumbColor={checked ? theme.accentForeground : theme.surface}
      {...props}
    />
  )
}
