import type { ReactNode } from "react"
import {
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { cn } from "../../utils/cn"
import { useDisplayDensity } from "../../hooks/use-display-density"

interface CompactControlProps extends Omit<PressableProps, "children" | "style"> {
  children: ReactNode
  accessibilityLabel: string
  className?: string
  surfaceStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
}

/** Standard 36/40dp surface/target; Compact 28/32dp, with content-driven growth. */
export function CompactControl({
  children,
  className,
  surfaceStyle,
  disabled,
  style,
  ...props
}: CompactControlProps) {
  const { control } = useDisplayDensity()
  return (
    <Pressable
      className={cn(
        "max-w-full justify-center active:opacity-60",
        disabled && "opacity-50",
        className
      )}
      accessibilityRole="button"
      disabled={disabled}
      {...props}
      style={[{ minHeight: control.choice, minWidth: control.choice }, style]}
      accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
    >
      <View
        className="min-h-control-surface flex-row items-center justify-center gap-control-choiceGap rounded-chip border border-border bg-surface px-control-choiceX py-control-choiceY"
        style={surfaceStyle}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {children}
      </View>
    </Pressable>
  )
}
