import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import { Check, ChevronRight } from "lucide-react-native"
import { AppSheetScaffold } from "./AppSheetScaffold"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { CompactControl } from "./CompactControl"
import { UI_ICON_SIZE } from "../../constants/ui-tokens"

export interface SelectionOption {
  value: string
  label: string
  description?: string
}

interface SelectionFieldProps {
  label: string
  value: string
  options: SelectionOption[]
  onChange: (value: string) => void
  description?: string
  /** Preserve an unavailable historical selection without changing stored data. */
  valueLabel?: string
  /** Inline preferences keep their label outside a compact value button. */
  layout?: "stacked" | "inline"
}

/** A compact summary that opens a scrollable, single-choice sheet. Dismissal changes nothing. */
export function SelectionField({
  label,
  value,
  options,
  onChange,
  description,
  valueLabel,
  layout = "stacked",
}: SelectionFieldProps) {
  const [open, setOpen] = useState(false)
  const theme = useThemeColors()
  const summary =
    valueLabel ?? options.find((option) => option.value === value)?.label ?? value

  return (
    <>
      {layout === "inline" ? (
        <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Text className="min-w-[96px] flex-1 text-sm text-muted-foreground">
            {label}
          </Text>
          <CompactControl
            onPress={() => setOpen(true)}
            accessibilityLabel={`${label}, ${summary}`}
            accessibilityState={{ expanded: open }}
          >
            <Text className="shrink text-sm text-foreground">{summary}</Text>
            <ChevronRight size={UI_ICON_SIZE.mini} color={theme.mutedForeground} />
          </CompactControl>
        </View>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${summary}`}
          accessibilityState={{ expanded: open }}
          className="min-h-12 flex-row items-center gap-3 rounded-control border border-border bg-surface px-3 py-3 active:opacity-60"
        >
          <View className="flex-1 gap-1">
            <Text className="text-xs text-muted-foreground">{label}</Text>
            <Text className="text-base font-medium text-foreground">{summary}</Text>
          </View>
          <ChevronRight size={20} color={theme.mutedForeground} />
        </Pressable>
      )}
      <AppSheetScaffold
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        subtitle={description}
        snapPoints={[75]}
        scroll
        unmountWhenClosed
      >
        <View className="gap-2">
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: option.value === value }}
              accessibilityLabel={[option.label, option.description]
                .filter(Boolean)
                .join(", ")}
              onPress={() => {
                setOpen(false)
                if (option.value !== value) onChange(option.value)
              }}
              className={`min-h-12 flex-row items-center gap-3 rounded-control border p-3 active:opacity-60 ${option.value === value ? "border-accent bg-muted" : "border-border bg-surface"}`}
            >
              <View className="flex-1 gap-1">
                <Text className="text-base font-medium text-foreground">
                  {option.label}
                </Text>
                {option.description ? (
                  <Text className="text-sm text-muted-foreground">
                    {option.description}
                  </Text>
                ) : null}
              </View>
              {option.value === value ? <Check size={20} color={theme.accent} /> : null}
            </Pressable>
          ))}
        </View>
      </AppSheetScaffold>
    </>
  )
}
