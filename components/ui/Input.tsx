import { forwardRef } from "react"
import { TextInput, type TextInputProps } from "react-native"
import { cn } from "../../utils/cn"
import { useThemeColors } from "../../hooks/use-theme-colors"

export interface InputProps extends TextInputProps {
  className?: string
}

export const Input = forwardRef<React.ElementRef<typeof TextInput>, InputProps>(
  ({ className, ...props }, ref) => {
    const theme = useThemeColors()
    return (
      <TextInput
        ref={ref}
        className={cn(
          "min-h-12 rounded-control bg-surface border border-border px-3 py-2 text-base text-foreground focus:border-accent",
          className
        )}
        placeholderTextColor={theme.mutedForeground}
        selectionColor={theme.accent}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"
