import { useState, type ReactNode } from "react"
import { Pressable, Text, View } from "react-native"
import { ChevronDown, ChevronUp } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { useDisplayDensity } from "../../hooks/use-display-density"

interface SourceSmsAccordionProps {
  body: string
  metadata?: ReactNode
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

/** List callers own recycling-aware state; keyed editor instances start collapsed. */
export function SourceSmsAccordion({
  body,
  metadata,
  expanded,
  onExpandedChange,
}: SourceSmsAccordionProps) {
  const [localExpanded, setLocalExpanded] = useState(false)
  const open = expanded ?? localExpanded
  const { t } = useTranslation()
  const theme = useThemeColors()
  const { icon } = useDisplayDensity()
  const Chevron = open ? ChevronUp : ChevronDown
  return (
    <View className="w-full overflow-hidden rounded-control border border-border bg-surface">
      <Pressable
        className="min-h-control-height flex-row items-center justify-between gap-ui-control bg-muted px-ui-section py-control-inputY active:opacity-60"
        onPress={() => (onExpandedChange ?? setLocalExpanded)(!open)}
        accessibilityRole="button"
        accessibilityLabel={t("smsImport.sheet.sourceSms")}
        accessibilityState={{ expanded: open }}
      >
        <Text className="flex-1 text-sm font-medium text-foreground">
          {t("smsImport.sheet.sourceSms")}
        </Text>
        <Chevron size={icon.medium} color={theme.mutedForeground} />
      </Pressable>
      {open ? (
        <View className="gap-ui-control border-t border-border p-ui-section">
          {metadata}
          <Text className="text-sm text-muted-foreground" selectable>
            {body}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
