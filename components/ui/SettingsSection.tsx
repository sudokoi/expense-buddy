import { memo, type ReactNode } from "react"
import { Card, YStack, Text } from "tamagui"
import { UI_OPACITY, UI_FONT_WEIGHT, UI_BORDER_WIDTH } from "../../constants/ui-tokens"

type SemanticSpaceToken =
  | "$micro"
  | "$control"
  | "$section"
  | "$gutter"
  | "$block"
  | "$empty"

interface SettingsSectionProps {
  title?: string
  description?: string
  children: ReactNode
  gap?: SemanticSpaceToken
}

function SectionTitle({ title, description }: { title?: string; description?: string }) {
  if (!title) return null
  return (
    <YStack
      gap="$micro"
      pb="$control"
      borderBottomWidth={UI_BORDER_WIDTH.thin}
      borderBottomColor="$borderColor"
    >
      <Text
        fontSize="$caption"
        fontWeight={UI_FONT_WEIGHT.bold}
        color="$color"
        opacity={UI_OPACITY.faint}
        textTransform="uppercase"
        letterSpacing={1}
      >
        {title}
      </Text>
      {description ? (
        <Text fontSize="$body" color="$color" opacity={UI_OPACITY.medium}>
          {description}
        </Text>
      ) : null}
    </YStack>
  )
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <YStack
      gap="$micro"
      pb="$control"
      borderBottomWidth={UI_BORDER_WIDTH.thin}
      borderBottomColor="$borderColor"
    >
      {children}
    </YStack>
  )
}

const SettingsSectionInternal = memo(function SettingsSection({
  title,
  description,
  children,
  gap = "$section",
}: SettingsSectionProps) {
  const hasTitle = title !== undefined || description !== undefined
  return (
    <Card p="$gutter" rounded="$surface" bg="$color1" borderColor="$borderColor">
      <YStack gap={gap}>
        {hasTitle && <SectionTitle title={title} description={description} />}
        {children}
      </YStack>
    </Card>
  )
})

export const SettingsSection = Object.assign(SettingsSectionInternal, {
  Header: SectionHeader,
})

export type { SettingsSectionProps }
