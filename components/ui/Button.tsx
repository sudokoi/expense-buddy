import React, { createContext, useContext, forwardRef } from "react"
import { Pressable, Text, View, type PressableProps } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import { LucideProvider } from "lucide-react-native"
import { cn } from "../../utils/cn"
import { NEUTRAL_COLORS, palette } from "../../constants/palette"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { useDisplayDensity } from "../../hooks/use-display-density"

const buttonVariants = cva(
  "flex-row items-center justify-center rounded-control active:opacity-60",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-border bg-surface",
        accent: "bg-accent",
        ghost: "bg-transparent",
        destructive: "bg-destructive",
      },
      size: {
        icon: "min-h-control-height min-w-control-height p-ui-control",
        chip: "min-h-control-height px-ui-section py-control-inputY",
        compact: "min-h-control-height px-ui-section py-control-inputY",
        control: "min-h-control-height px-control-actionX py-control-actionY",
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
      // The destructive fill is theme-invariant; white is its tested foreground.
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
  icon?: React.ReactNode
}

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

export const ButtonText = forwardRef<
  React.ElementRef<typeof Text>,
  React.ComponentPropsWithoutRef<typeof Text>
>(({ className, children, ...props }, ref) => {
  const ctx = useButtonContext()
  const colorClass = ctx ? ctx.textClass : buttonTextVariants({ variant: "default" })
  return (
    <Text
      ref={ref}
      className={cn("text-default text-center", colorClass, className)}
      {...props}
    >
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

const ButtonBase = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ className, variant, size, icon, children, disabled, ...props }, ref) => {
    const theme = useThemeColors()
    const { density } = useDisplayDensity()
    const resolvedVariant: NonNullable<ButtonVariant> = variant ?? "default"
    const colorKey = VARIANT_TEXT_COLOR_KEY[resolvedVariant]
    const iconColor = colorKey === "white" ? NEUTRAL_COLORS.white : theme[colorKey]
    const textClass = buttonTextVariants({ variant: resolvedVariant })
    const hitSlop =
      props.hitSlop ?? (size === "chip" && density === "standard" ? 8 : undefined)

    const content =
      typeof children === "string" || typeof children === "number" ? (
        <ButtonText className="shrink text-center">{children}</ButtonText>
      ) : (
        children
      )

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
        accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
      >
        <ButtonContext.Provider
          value={{ variant: resolvedVariant, iconColor, textClass }}
        >
          <LucideProvider color={iconColor}>
            <View className="min-w-0 shrink flex-row items-center justify-center gap-ui-control">
              {icon}
              {content}
            </View>
          </LucideProvider>
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
