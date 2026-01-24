import { H4 } from "tamagui"
import { ReactNode } from "react"

interface SectionHeaderProps {
  children?: ReactNode
}

/**
 * SectionHeader - A styled H4 for consistent section titles
 */
export function SectionHeader({ children }: SectionHeaderProps) {
  // Using type assertion to work around Tamagui's complex type inference
  const H4Component = H4 as React.ComponentType<{
    fontSize: string
    marginBottom: string
    children?: ReactNode
    numberOfLines?: number
    adjustsFontSizeToFit?: boolean
    minimumFontScale?: number
  }>
  return (
    <H4Component
      fontSize="$5"
      marginBottom="$4"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.4}
    >
      {children}
    </H4Component>
  )
}

export type { SectionHeaderProps }
