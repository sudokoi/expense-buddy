import { createContext, useContext } from "react"
import { Pressable, View, type ViewProps } from "react-native"
import { cn } from "../../utils/cn"

interface RadioGroupContextValue {
  value: string | undefined
  onValueChange: (value: string) => void
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null)

export interface RadioGroupProps extends ViewProps {
  value: string | undefined
  onValueChange: (value: string) => void
}

export function RadioGroup({
  value,
  onValueChange,
  className,
  ...props
}: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <View className={cn("gap-2", className)} {...props} />
    </RadioGroupContext.Provider>
  )
}

export interface RadioGroupItemProps extends ViewProps {
  value: string
}

function RadioGroupItem({ value, className, children, ...props }: RadioGroupItemProps) {
  const ctx = useContext(RadioGroupContext)
  if (!ctx) {
    throw new Error("RadioGroup.Item must be used within a RadioGroup")
  }
  const selected = ctx.value === value

  return (
    <Pressable
      {...props}
      onPress={() => ctx.onValueChange(value)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={cn(
        "h-5 w-5 items-center justify-center rounded-full border-2",
        selected ? "border-accent" : "border-border",
        className
      )}
    >
      {selected ? <View className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
      {children}
    </Pressable>
  )
}

RadioGroup.Item = RadioGroupItem
