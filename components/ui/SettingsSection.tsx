import { Card, YStack, Text } from "tamagui"
import { ReactNode } from "react"

interface SettingsSectionProps {
  /** Section title displayed as uppercase header */
  title: string
  /** Optional short description below the title */
  description?: string
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
export function SettingsSection({
  title,
  description,
  children,
  gap = "$3",
}: SettingsSectionProps) {
  return (
    <Card
      bordered
      padding="$4"
      borderRadius="$6"
      backgroundColor="$color1"
      borderColor="$borderColor"
    >
      <YStack gap={gap as "$3"}>
        <YStack gap="$1.5" pb="$2" borderBottomWidth={1} borderBottomColor="$borderColor">
          <Text
            fontSize="$2"
            fontWeight="700"
            color="$color"
            opacity={0.52}
            textTransform="uppercase"
            letterSpacing={1}
          >
            {title}
          </Text>
          {description ? (
            <Text fontSize="$3" color="$color" opacity={0.72} lineHeight={20}>
              {description}
            </Text>
          ) : null}
        </YStack>
        {children}
      </YStack>
    </Card>
  )
}

export type { SettingsSectionProps }
