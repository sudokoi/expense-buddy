import { useMemo, type ReactNode } from "react"
import { View } from "react-native"
import { vars } from "nativewind"
import { densityVariables } from "../constants/display-density"
import { useDisplayDensity } from "../hooks/use-display-density"

/** Install variables in both modes from the first render to avoid interop remounts. */
export function DisplayDensityProvider({ children }: { children: ReactNode }) {
  const { density } = useDisplayDensity()
  const style = useMemo(() => vars(densityVariables(density)), [density])
  return (
    <View className="flex-1" style={style}>
      {children}
    </View>
  )
}
