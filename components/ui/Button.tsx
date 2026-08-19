import { forwardRef, Children, cloneElement, isValidElement, type ReactNode } from "react"
import { Pressable, Text, type PressableProps } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import { LucideProvider } from "lucide-react-native"
import { cn } from "../../utils/cn"
import { NEUTRAL_COLORS, palette } from "../../constants/palette"
import { useThemeColors } from "../../hooks/use-theme-colors"

const buttonVariants = cva(
  "flex-row items-center justify-center rounded-control active:opacity-60",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-border bg-transparent",
        accent: "bg-accent",
        ghost: "bg-transparent",
        destructive: "bg-destructive",
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
  }
)

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

/** Maps a button variant to its text/icon color token (accent variants invert). */
const VARIANT_TEXT_COLOR_KEY: Record<
  NonNullable<ButtonVariant>,
  keyof typeof palette.light | "white"
> = {
  default: "foreground",
  outline: "foreground",
  accent: "accentForeground",
  ghost: "foreground",
  destructive: "white",
}

// Matches any existing text color utility so callers can override the button color.
const TEXT_COLOR_CLASS_RE =
  /\btext-(?:foreground|muted-foreground|accent|accent-foreground|error|success|warning|info|expense|income|background|white|black|kawaii-[a-z-]+)\b/

function wrapTextChildren(children: ReactNode, variant: ButtonVariant): ReactNode {
  const colorClass = buttonTextVariants({ variant })
  return Children.map(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      return <Text className={colorClass}>{child}</Text>
    }
    if (isValidElement<{ className?: string }>(child) && child.type === Text) {
      const existing = child.props.className ?? ""
      // Respect an explicit text color already set by the caller.
      if (TEXT_COLOR_CLASS_RE.test(existing)) return child
      return cloneElement(child, { className: cn(colorClass, existing) })
    }
    return child
  })
}

export const Button = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ className, variant, size, children, disabled, ...props }, ref) => {
    const theme = useThemeColors()
    const resolvedVariant = variant ?? "default"
    const colorKey = VARIANT_TEXT_COLOR_KEY[resolvedVariant]
    const iconColor = colorKey === "white" ? NEUTRAL_COLORS.white : theme[colorKey]
    return (
      <Pressable
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          disabled && "opacity-50",
          className
        )}
        disabled={disabled}
        accessibilityRole="button"
        {...props}
      >
        <LucideProvider color={iconColor}>
          {wrapTextChildren(children as ReactNode, resolvedVariant)}
        </LucideProvider>
      </Pressable>
    )
  }
)

Button.displayName = "Button"

export { buttonVariants }
