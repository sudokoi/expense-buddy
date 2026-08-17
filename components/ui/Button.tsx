import { forwardRef, Children, type ReactNode } from "react"
import { Pressable, Text, type PressableProps } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../utils/cn"

const buttonVariants = cva("flex-row items-center justify-center rounded-control", {
  variants: {
    variant: {
      default: "bg-transparent",
      outline: "border border-border bg-transparent",
      accent: "bg-accent",
      ghost: "bg-transparent",
      destructive: "bg-error",
    },
    size: {
      icon: "h-5 px-1",
      chip: "h-7 px-3",
      compact: "h-9 px-3",
      control: "h-11 px-4",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "control",
  },
})

const buttonTextVariants = cva("text-foreground", {
  variants: {
    variant: {
      default: "text-foreground",
      outline: "text-foreground",
      accent: "text-accent-foreground",
      ghost: "text-foreground",
      destructive: "text-white",
    },
  },
})

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"]

export interface ButtonProps extends PressableProps, VariantProps<typeof buttonVariants> {
  className?: string
}

function wrapTextChildren(children: ReactNode, variant: ButtonVariant): ReactNode {
  return Children.map(children, (child) =>
    typeof child === "string" || typeof child === "number" ? (
      <Text className={buttonTextVariants({ variant })}>{child}</Text>
    ) : (
      child
    )
  )
}

export const Button = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ className, variant, size, children, disabled, ...props }, ref) => {
    return (
      <Pressable
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          disabled && "opacity-50",
          className
        )}
        disabled={disabled}
        {...props}
      >
        {wrapTextChildren(children as ReactNode, variant)}
      </Pressable>
    )
  }
)

Button.displayName = "Button"

export { buttonVariants }
