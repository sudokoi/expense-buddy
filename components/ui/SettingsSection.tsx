import { View, Text } from "react-native"
import { ReactNode } from "react"
import { Card } from "./Card"
import { UI_OPACITY } from "../../constants/ui-tokens"

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
 */
export function SettingsSection({
  title,
  description,
  children,
  gap = "$section",
}: SettingsSectionProps) {
  return (
    <Card className="p-4">
      <View className={gapClass[gap]}>
        <View className="gap-1 border-b border-border pb-2">
          <Text
            className="text-xs font-bold uppercase tracking-wide text-foreground"
            style={{ opacity: UI_OPACITY.faint }}
          >
            {title}
          </Text>
          {description ? (
            <Text
              className="text-[13px] text-foreground"
              style={{ opacity: UI_OPACITY.medium }}
            >
              {description}
            </Text>
          ) : null}
        </View>
        {children}
      </View>
    </Card>
  )
}

export type { SettingsSectionProps }
