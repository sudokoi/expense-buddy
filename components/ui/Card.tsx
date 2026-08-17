import { forwardRef } from "react"
import { View, type ViewProps } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../utils/cn"

const cardVariants = cva("rounded-card bg-surface border border-border", {
  variants: {
    variant: {
      default: "",
      elevated: "shadow-sm",
      ghost: "border-transparent bg-transparent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface CardProps extends ViewProps, VariantProps<typeof cardVariants> {
  className?: string
}

export const Card = forwardRef<React.ElementRef<typeof View>, CardProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <View
        ref={ref}
        className={cn(cardVariants({ variant }), className)}
        {...props}
      />
    )
  }
)

Card.displayName = "Card"

export { cardVariants }
