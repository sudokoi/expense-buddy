import { View, Text } from "react-native"
import { ReactNode } from "react"
import { Card } from "./Card"
import type { LucideIcon } from "lucide-react-native"
import { CARD_COLORS } from "../../constants/palette"
import { useThemeScheme } from "../../hooks/use-theme-colors"

type SemanticSpaceToken =
  "$micro" | "$control" | "$section" | "$gutter" | "$block" | "$empty"

const gapClass: Record<SemanticSpaceToken, string> = {
  $micro: "gap-1",
  $control: "gap-2",
  $section: "gap-3",
  $gutter: "gap-5",
  $block: "gap-6",
  $empty: "gap-10",
}

interface SettingsSectionProps {
  /** Localized section heading */
  title: string
  /** Decorative wayfinding icon; the heading remains the accessible label. */
  icon?: LucideIcon
  tone?: keyof typeof CARD_COLORS.light
  /** Optional short description below the title */
  description?: string
  /** Content to render inside the section */
  children: ReactNode
  /** Optional gap between children, defaults to $section */
  gap?: SemanticSpaceToken
}

/**
 * SettingsSection - A reusable card component for settings screen sections
 */
export function SettingsSection({
  title,
  icon: Icon,
  tone = "purple",
  description,
  children,
  gap = "$section",
}: SettingsSectionProps) {
  const colors = CARD_COLORS[useThemeScheme()][tone]
  return (
    <Card className="p-3">
      <View className={gapClass[gap]}>
        <View className="gap-2 pb-1">
          <View className="flex-row items-center gap-3">
            {Icon ? (
              <View
                className="h-10 w-10 items-center justify-center rounded-control"
                style={{ backgroundColor: colors.bg }}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                <Icon size={22} color={colors.text} />
              </View>
            ) : null}
            <Text
              className="flex-1 text-base font-semibold text-foreground"
              accessibilityRole="header"
            >
              {title}
            </Text>
          </View>
          {description ? (
            <Text className="text-sm text-muted-foreground">{description}</Text>
          ) : null}
        </View>
        {children}
      </View>
    </Card>
  )
}

export type { SettingsSectionProps }
