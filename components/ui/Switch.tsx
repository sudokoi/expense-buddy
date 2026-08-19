import { Switch as RNSwitch, type SwitchProps as RNSwitchProps } from "react-native"
import { SEMANTIC_COLORS } from "../../constants/palette"
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
      trackColor={{ true: SEMANTIC_COLORS.success, false: undefined }}
      {...props}
    />
  )
}
