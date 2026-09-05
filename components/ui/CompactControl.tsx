import type { ReactNode } from "react"
import {
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { cn } from "../../utils/cn"
import { UI_COMPACT_TOUCH_TARGET } from "../../constants/ui-tokens"

interface CompactControlProps extends Omit<PressableProps, "children" | "style"> {
  children: ReactNode
  accessibilityLabel: string
  className?: string
  surfaceStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
}

/** A 36dp visual control inside a 40dp target, without overlapping hit slop. */
export function CompactControl({
  children,
  className,
  surfaceStyle,
  disabled,
  style,
  ...props
}: CompactControlProps) {
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
      style={[
        { minHeight: UI_COMPACT_TOUCH_TARGET, minWidth: UI_COMPACT_TOUCH_TARGET },
        style,
      ]}
      accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
    >
      <View
        className="min-h-9 flex-row items-center justify-center gap-1.5 rounded-chip border border-border bg-surface px-2 py-1"
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
