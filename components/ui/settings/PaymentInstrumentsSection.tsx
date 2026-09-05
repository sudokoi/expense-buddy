import { useCallback, useMemo, useState } from "react"
import { Alert, Pressable, Text, View } from "react-native"
import { Plus, Trash, ChevronDown, ChevronUp } from "lucide-react-native"
import { Button } from "../Button"
import { IconActionButton } from "../IconActionButton"
import { PaymentInstrumentForm } from "../PaymentInstrumentForm"
import { useSettings, useUIState } from "../../../stores/hooks"
import {
  getActivePaymentInstruments,
  PAYMENT_INSTRUMENT_METHODS,
} from "../../../services/payment-instruments"
import { getPaymentMethodI18nKey } from "../../../constants/payment-methods"
import { useTranslation } from "react-i18next"
import { useThemeColors } from "../../../hooks/use-theme-colors"
import type { PaymentInstrument } from "../../../types/payment-instrument"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []

export function PaymentInstrumentsSection() {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const { settings, updateSettings } = useSettings()
  const { paymentInstrumentsSectionExpanded: expanded, setPaymentInstrumentsExpanded } =
    useUIState()
  const instruments = settings.paymentInstruments ?? EMPTY_INSTRUMENTS
  const active = useMemo(
    () =>
      getActivePaymentInstruments(instruments).sort((a, b) =>
        a.nickname.localeCompare(b.nickname)
      ),
    [instruments]
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentInstrument | undefined>()

  const handleDelete = useCallback(
    (instrument: PaymentInstrument) => {
      Alert.alert(
        t("instruments.removeDialog.title"),
        t("instruments.removeDialog.message", { nickname: instrument.nickname }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("instruments.remove"),
            style: "destructive",
            onPress: () => {
              const now = new Date().toISOString()
              updateSettings({
                paymentInstruments: instruments.map((item) =>
                  item.id === instrument.id
                    ? { ...item, deletedAt: now, updatedAt: now }
                    : item
                ),
              })
            },
          },
        ]
      )
    },
    [instruments, updateSettings, t]
  )

  const handleSave = useCallback(
    (instrument: PaymentInstrument) => {
      updateSettings({
        paymentInstruments: instruments.some((item) => item.id === instrument.id)
          ? instruments.map((item) => (item.id === instrument.id ? instrument : item))
          : [instrument, ...instruments],
      })
      setPaymentInstrumentsExpanded(true)
    },
    [instruments, updateSettings, setPaymentInstrumentsExpanded]
  )

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Pressable
          className="min-h-12 flex-1 flex-row items-center gap-2 active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={`${t("instruments.manage")}, ${active.length}`}
          accessibilityState={{ expanded }}
          onPress={() => setPaymentInstrumentsExpanded(!expanded)}
        >
          <Text className="flex-1 text-base font-semibold text-foreground">
            {t("instruments.title")} ({active.length})
          </Text>
          {expanded ? (
            <ChevronUp size={20} color={theme.mutedForeground} />
          ) : (
            <ChevronDown size={20} color={theme.mutedForeground} />
          )}
        </Pressable>
        <Button
          icon={<Plus size={16} />}
          disabled={formOpen}
          onPress={() => {
            setEditing(undefined)
            setFormOpen(true)
          }}
        >
          {t("instruments.add")}
        </Button>
      </View>
      {formOpen ? (
        <View className="gap-3 border-y border-border py-3">
          <Text
            className="text-base font-semibold text-foreground"
            accessibilityRole="header"
          >
            {editing ? t("instruments.form.editTitle") : t("instruments.form.addTitle")}
          </Text>
          <PaymentInstrumentForm
            key={editing?.id ?? "new"}
            onClose={() => setFormOpen(false)}
            existingInstruments={instruments}
            instrument={editing}
            onSave={handleSave}
          />
        </View>
      ) : null}
      {active.length === 0 ? (
        <Text className="text-sm text-muted-foreground">
          {t("instruments.description")}
        </Text>
      ) : null}
      {expanded && !formOpen
        ? PAYMENT_INSTRUMENT_METHODS.map((method) => {
            const list = active.filter((item) => item.method === method)
            if (list.length === 0) return null
            const methodLabel = t(`paymentMethods.${getPaymentMethodI18nKey(method)}`)
            return (
              <View key={method} className="gap-1">
                <Text className="text-xs font-semibold text-muted-foreground">
                  {methodLabel}
                </Text>
                {list.map((instrument) => (
                  <View
                    key={instrument.id}
                    className="flex-row items-center border-b border-border py-1"
                  >
                    <Pressable
                      className="min-h-12 flex-1 justify-center gap-1 py-2 active:opacity-60"
                      accessibilityRole="button"
                      accessibilityLabel={t("common.editLabel", {
                        label: `${instrument.nickname}, ${methodLabel}, ${instrument.lastDigits}`,
                      })}
                      onPress={() => {
                        setEditing(instrument)
                        setFormOpen(true)
                      }}
                    >
                      <Text className="text-base font-medium text-foreground">
                        {instrument.nickname}
                      </Text>
                      <Text className="text-sm text-muted-foreground">
                        {methodLabel} · •••• {instrument.lastDigits}
                      </Text>
                    </Pressable>
                    <IconActionButton
                      icon={<Trash size={18} />}
                      onPress={() => handleDelete(instrument)}
                      accessibilityLabel={t("common.removeLabel", {
                        label: instrument.nickname,
                      })}
                      tooltip={t("common.removeLabel", { label: instrument.nickname })}
                    />
                  </View>
                ))}
              </View>
            )
          })
        : null}
    </View>
  )
}
