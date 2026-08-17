import { Text } from "react-native"
import { ReactNode } from "react"

interface SectionHeaderProps {
  children?: ReactNode
}

/**
 * SectionHeader - A styled heading for consistent section titles
 */
export function SectionHeader({ children }: SectionHeaderProps) {
  return (
    <Text
      className="mb-4 text-base font-semibold text-foreground"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.4}
    >
      {children}
    </Text>
  )
}

export type { SectionHeaderProps }
