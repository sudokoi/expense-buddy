import { Switch as RNSwitch, type SwitchProps as RNSwitchProps } from "react-native"
import { SEMANTIC_COLORS } from "../../constants/palette"

export interface SwitchProps extends Omit<RNSwitchProps, "value" | "onValueChange"> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function Switch({ checked, onCheckedChange, ...props }: SwitchProps) {
  return (
    <RNSwitch
      value={checked}
      onValueChange={onCheckedChange}
      trackColor={{ true: SEMANTIC_COLORS.success, false: undefined }}
      {...props}
    />
  )
}
