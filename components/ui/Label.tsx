import { forwardRef } from "react"
import { Text, type TextProps } from "react-native"
import { cn } from "../../utils/cn"

export interface LabelProps extends TextProps {
  className?: string
}

export const Label = forwardRef<React.ElementRef<typeof Text>, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <Text
        ref={ref}
        className={cn("text-sm font-medium text-foreground", className)}
        {...props}
      />
    )
  }
)

Label.displayName = "Label"
