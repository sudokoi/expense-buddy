import React, { createContext, useContext, forwardRef } from "react"
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
        outline: "border border-border bg-muted",
        accent: "bg-accent",
        ghost: "bg-transparent",
        destructive: "bg-destructive",
      },
      size: {
        icon: "h-5 px-1",
        chip: "h-7 px-2",
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

const buttonTextVariants = cva("", {
  variants: {
    variant: {
      default: "text-foreground",
      outline: "text-foreground",
      accent: "text-accent-foreground",
      ghost: "text-foreground",
      destructive: "text-white",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"]

export interface ButtonProps
  extends Omit<PressableProps, "children">, VariantProps<typeof buttonVariants> {
  className?: string
  children?: React.ReactNode
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

type ButtonContextValue = {
  variant: NonNullable<ButtonVariant>
  iconColor: string
  textClass: string
}

const ButtonContext = createContext<ButtonContextValue | null>(null)

function useButtonContext(): ButtonContextValue | null {
  return useContext(ButtonContext)
}

// Composition primitives — use inside <Button> instead of raw <Text>/<Icon> + cloneElement

export const ButtonText = forwardRef<
  React.ElementRef<typeof Text>,
  React.ComponentPropsWithoutRef<typeof Text>
>(({ className, children, ...props }, ref) => {
  const ctx = useButtonContext()
  const colorClass = ctx ? ctx.textClass : buttonTextVariants({ variant: "default" })
  return (
    <Text ref={ref} className={cn(colorClass, className)} {...props}>
      {children}
    </Text>
  )
})
ButtonText.displayName = "ButtonText"

type IconComponent = React.ComponentType<{ size?: number; color?: string }>

type ButtonIconProps = {
  as: IconComponent
  size?: number
  color?: string
} & Record<string, unknown>

export function ButtonIcon({ as: Icon, color, size, ...rest }: ButtonIconProps) {
  const ctx = useButtonContext()
  const resolvedColor = color ?? ctx?.iconColor
  return <Icon size={size} color={resolvedColor} {...rest} />
}

function wrapChildrenWithComposition(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      return <ButtonText>{child}</ButtonText>
    }
    if (
      React.isValidElement<{ className?: string; children?: React.ReactNode }>(child) &&
      child.type === Text
    ) {
      const existing = child.props.className ?? ""
      if (
        /\btext-(?:foreground|muted-foreground|accent|accent-foreground|error|success|warning|info|expense|income|background|white|black|kawaii-[a-z-]+)\b/.test(
          existing
        )
      ) {
        return child
      }
      return (
        <ButtonText className={existing}>
          {child.props.children as React.ReactNode}
        </ButtonText>
      )
    }
    if (
      React.isValidElement<{ size?: number; color?: string }>(child) &&
      child.props.size !== undefined &&
      child.props.color === undefined
    ) {
      const Icon = child.type as IconComponent
      const size = child.props.size
      return <ButtonIcon as={Icon} size={size} />
    }
    return child
  })
}

const ButtonBase = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ className, variant, size, children, disabled, ...props }, ref) => {
    const theme = useThemeColors()
    const resolvedVariant: NonNullable<ButtonVariant> = variant ?? "default"
    const colorKey = VARIANT_TEXT_COLOR_KEY[resolvedVariant]
    const iconColor = colorKey === "white" ? NEUTRAL_COLORS.white : theme[colorKey]
    const textClass = buttonTextVariants({ variant: resolvedVariant })
    const hitSlop = size === "chip" ? 8 : props.hitSlop

    const content = wrapChildrenWithComposition(children)

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
        hitSlop={hitSlop}
        {...props}
      >
        <ButtonContext.Provider
          value={{ variant: resolvedVariant, iconColor, textClass }}
        >
          <LucideProvider color={iconColor}>{content}</LucideProvider>
        </ButtonContext.Provider>
      </Pressable>
    )
  }
)

ButtonBase.displayName = "Button"

export const Button = Object.assign(ButtonBase, {
  Text: ButtonText,
  Icon: ButtonIcon,
})

export { buttonVariants }
export { ButtonContext }
