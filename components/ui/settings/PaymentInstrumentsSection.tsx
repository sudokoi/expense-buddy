import { useCallback, useMemo, useState } from "react"
import { View, Text, Pressable } from "react-native"
import { Alert } from "react-native"
import { Plus, Edit3, Trash, ChevronDown, ChevronUp } from "lucide-react-native"
import { Button } from "../Button"
import { IconActionButton } from "../IconActionButton"
import { useSettings, useUIState } from "../../../stores/hooks"
import type { PaymentInstrument } from "../../../types/payment-instrument"
import {
  formatPaymentInstrumentLabel,
  getActivePaymentInstruments,
  PAYMENT_INSTRUMENT_METHODS,
} from "../../../services/payment-instruments"
import { methodShortLabel } from "../../../utils/analytics/filter-summary"
import { PaymentInstrumentFormModal } from "../PaymentInstrumentFormModal"
import { useTranslation } from "react-i18next"
import { UI_OPACITY, UI_FONT_WEIGHT, UI_ICON_SIZE } from "../../../constants/ui-tokens"
import { useThemeColors } from "../../../hooks/use-theme-colors"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []

function upsertInstrument(
  list: PaymentInstrument[],
  inst: PaymentInstrument
): PaymentInstrument[] {
  const index = list.findIndex((i) => i.id === inst.id)
  if (index === -1) return [inst, ...list]
  const next = [...list]
  next[index] = inst
  return next
}

export function PaymentInstrumentsSection() {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const { settings, updateSettings } = useSettings()
  const { paymentInstrumentsSectionExpanded, setPaymentInstrumentsExpanded } =
    useUIState()

  const instruments = settings.paymentInstruments ?? EMPTY_INSTRUMENTS
  const active = useMemo(() => getActivePaymentInstruments(instruments), [instruments])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentInstrument | undefined>(undefined)

  const grouped = useMemo(() => {
    const byMethod: Record<string, PaymentInstrument[]> = Object.fromEntries(
      PAYMENT_INSTRUMENT_METHODS.map((method) => [method, []])
    )
    for (const inst of active) {
      byMethod[inst.method]?.push(inst)
    }
    for (const key of Object.keys(byMethod)) {
      byMethod[key].sort((a, b) => a.nickname.localeCompare(b.nickname))
    }
    return byMethod
  }, [active])

  const handleAdd = useCallback(() => {
    setEditing(undefined)
    setFormOpen(true)
  }, [])

  const handleEdit = useCallback((inst: PaymentInstrument) => {
    setEditing(inst)
    setFormOpen(true)
  }, [])

  const handleDelete = useCallback(
    (inst: PaymentInstrument) => {
      Alert.alert(
        t("instruments.removeDialog.title"),
        t("instruments.removeDialog.message", { nickname: inst.nickname }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("instruments.remove"),
            style: "destructive",
            onPress: () => {
              const now = new Date().toISOString()
              const nextList = instruments.map((i) =>
                i.id === inst.id
                  ? {
                      ...i,
                      deletedAt: now,
                      updatedAt: now,
                    }
                  : i
              )
              updateSettings({ paymentInstruments: nextList })
            },
          },
        ]
      )
    },
    [instruments, updateSettings, t]
  )

  const handleSave = useCallback(
    (inst: PaymentInstrument) => {
      const nextList = upsertInstrument(instruments, inst)
      updateSettings({ paymentInstruments: nextList })
    },
    [instruments, updateSettings]
  )

  return (
    <>
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1">
            <Text
              className="text-sm font-semibold text-foreground"
              style={{ fontWeight: UI_FONT_WEIGHT.semiBold }}
            >
              {t("instruments.title")}
            </Text>
            <Text
              className="text-[13px] text-foreground"
              style={{ opacity: UI_OPACITY.subtle }}
            >
              {active.length > 0
                ? t("instruments.manage") + ` (${active.length})`
                : t("instruments.description")}
            </Text>
          </View>
          <Button size="chip" icon={<Plus size={16} />} onPress={handleAdd}>
            {t("instruments.add")}
          </Button>
        </View>

        {active.length === 0 ? (
          <Text className="text-foreground" style={{ opacity: UI_OPACITY.subtle }}>
            {t("instruments.empty")}
          </Text>
        ) : (
          <View>
            <Pressable
              onPress={() =>
                setPaymentInstrumentsExpanded(!paymentInstrumentsSectionExpanded)
              }
              className="flex-row items-center justify-between rounded-chip border border-border bg-surface px-3 py-2.5"
              accessibilityRole="button"
              accessibilityLabel={t("instruments.manage")}
              accessibilityState={{ expanded: paymentInstrumentsSectionExpanded }}
            >
              <View className="flex-1 flex-row items-center gap-2">
                <Text
                  className="text-foreground"
                  style={{ fontWeight: UI_FONT_WEIGHT.medium }}
                >
                  {t("instruments.manage")}
                </Text>
                <Text
                  className="text-xs text-foreground"
                  style={{ opacity: UI_OPACITY.subtle }}
                >
                  ({active.length})
                </Text>
              </View>
              {paymentInstrumentsSectionExpanded ? (
                <ChevronUp
                  size={UI_ICON_SIZE.medium}
                  color={theme.foreground}
                  style={{ opacity: UI_OPACITY.subtle }}
                />
              ) : (
                <ChevronDown
                  size={UI_ICON_SIZE.medium}
                  color={theme.foreground}
                  style={{ opacity: UI_OPACITY.subtle }}
                />
              )}
            </Pressable>

            {paymentInstrumentsSectionExpanded && (
              <View className="px-2 pt-3">
                <View className="gap-4 rounded-card bg-surface p-3">
                  {PAYMENT_INSTRUMENT_METHODS.map((method) => {
                    const list = grouped[method] ?? []
                    if (list.length === 0) return null
                    return (
                      <View key={method} className="gap-3">
                        <Text
                          className="text-xs text-foreground"
                          style={{
                            fontWeight: UI_FONT_WEIGHT.bold,
                            opacity: UI_OPACITY.faint,
                          }}
                        >
                          {methodShortLabel(method)}
                        </Text>
                        {list.map((inst) => (
                          <View
                            key={inst.id}
                            className="flex-row items-center justify-between gap-2 rounded-card bg-muted px-3 py-3"
                          >
                            <Text
                              className="flex-1 text-foreground"
                              numberOfLines={1}
                              style={{ opacity: 0.9 }}
                            >
                              {formatPaymentInstrumentLabel(inst)}
                            </Text>
                            <IconActionButton
                              icon={
                                <Edit3
                                  size={UI_ICON_SIZE.small}
                                  color={theme.foreground}
                                />
                              }
                              onPress={() => handleEdit(inst)}
                              tooltip={t("common.editLabel", {
                                label: formatPaymentInstrumentLabel(inst),
                              })}
                              accessibilityLabel={t("common.editLabel", {
                                label: formatPaymentInstrumentLabel(inst),
                              })}
                            />
                            <IconActionButton
                              icon={
                                <Trash
                                  size={UI_ICON_SIZE.small}
                                  color={theme.foreground}
                                />
                              }
                              onPress={() => handleDelete(inst)}
                              tooltip={t("common.removeLabel", {
                                label: formatPaymentInstrumentLabel(inst),
                              })}
                              accessibilityLabel={t("common.removeLabel", {
                                label: formatPaymentInstrumentLabel(inst),
                              })}
                            />
                          </View>
                        ))}
                      </View>
                    )
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      <PaymentInstrumentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        existingInstruments={instruments}
        instrument={editing}
        onSave={handleSave}
      />
    </>
  )
}
