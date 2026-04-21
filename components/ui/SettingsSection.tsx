import { Card, YStack, Text } from "tamagui"
import { ReactNode } from "react"

type SemanticSpaceToken =
  | "$micro"
  | "$control"
  | "$section"
  | "$gutter"
  | "$block"
  | "$empty"

interface SettingsSectionProps {
  /** Section title displayed as uppercase header */
  title: string
  /** Optional short description below the title */
  description?: string
  /** Content to render inside the section */
  children: ReactNode
  /** Optional gap between children, defaults to $section */
  gap?: SemanticSpaceToken
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
  gap = "$section",
}: SettingsSectionProps) {
  return (
    <Card
      bordered
      padding="$gutter"
      borderRadius="$surface"
      backgroundColor="$color1"
      borderColor="$borderColor"
    >
      <YStack gap={gap}>
        <YStack
          gap="$micro"
          pb="$control"
          borderBottomWidth={1}
          borderBottomColor="$borderColor"
        >
          <Text
            fontSize="$caption"
            fontWeight="700"
            color="$color"
            opacity={0.52}
            textTransform="uppercase"
            letterSpacing={1}
          >
            {title}
          </Text>
          {description ? (
            <Text fontSize="$body" color="$color" opacity={0.72} lineHeight={20}>
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
