import { Card, YStack, Text } from "tamagui"
import { ReactNode } from "react"

interface SettingsSectionProps {
  /** Section title displayed as uppercase header */
  title: string
  /** Content to render inside the section */
  children: ReactNode
  /** Optional gap between children, defaults to $3 */
  gap?: string
}

/**
 * SettingsSection - A reusable card component for settings screen sections
 *
 * Provides consistent styling with:
 * - Bordered card with padding and border radius
 * - Uppercase section header with consistent typography
 * - Configurable gap between children
 *
 * @example
 * ```tsx
 * <SettingsSection title="APPEARANCE">
 *   <ThemeSelector value={theme} onChange={setTheme} />
 * </SettingsSection>
 * ```
 */
export function SettingsSection({ title, children, gap = "$3" }: SettingsSectionProps) {
  return (
    <Card bordered padding="$4" borderRadius="$4">
      <YStack gap={gap as "$3"}>
        <Text
          fontSize="$2"
          fontWeight="600"
          color="$color"
          opacity={0.6}
          textTransform="uppercase"
          letterSpacing={1}
        >
          {title}
        </Text>
        {children}
      </YStack>
    </Card>
  )
}

export type { SettingsSectionProps }
