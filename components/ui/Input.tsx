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
          "rounded-control bg-surface border border-border px-3 py-2 text-foreground",
          className
        )}
        placeholderTextColor={theme.mutedForeground}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"
