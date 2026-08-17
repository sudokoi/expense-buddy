import { forwardRef } from "react"
import { TextInput, type TextInputProps } from "react-native"
import { cn } from "../../utils/cn"

export interface InputProps extends TextInputProps {
  className?: string
}

export const Input = forwardRef<React.ElementRef<typeof TextInput>, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        className={cn(
          "rounded-control bg-surface px-3 py-2 text-foreground dark:border dark:border-border",
          className
        )}
        placeholderTextColor="var(--muted-foreground)"
        {...props}
      />
    )
  }
)

Input.displayName = "Input"
