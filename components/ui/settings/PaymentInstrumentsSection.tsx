import { useCallback, useMemo, useState } from "react"
import { YStack, XStack, Text, Button, Accordion } from "tamagui"
import { Alert } from "react-native"
import { Plus, Edit3, Trash, ChevronDown, ChevronUp } from "@tamagui/lucide-icons-2"
import { useSettings, useUIState } from "../../../stores/hooks"
import type { PaymentInstrument } from "../../../types/payment-instrument"
import {
  formatPaymentInstrumentLabel,
  getActivePaymentInstruments,
} from "../../../services/payment-instruments"
import { PaymentInstrumentFormModal } from "../PaymentInstrumentFormModal"
import { useTranslation } from "react-i18next"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../../constants/ui-tokens"

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
  const { settings, updateSettings } = useSettings()
  const { paymentInstrumentsSectionExpanded, setPaymentInstrumentsExpanded } =
    useUIState()

  const instruments = settings.paymentInstruments ?? EMPTY_INSTRUMENTS
  const active = useMemo(() => getActivePaymentInstruments(instruments), [instruments])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentInstrument | undefined>(undefined)

  const grouped = useMemo(() => {
    const byMethod: Record<string, PaymentInstrument[]> = {
      "Credit Card": [],
      "Debit Card": [],
      UPI: [],
    }
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
      <YStack gap="$section">
        <XStack justify="space-between" items="center">
          <YStack flex={1} gap="$micro">
            <Text fontSize="$label" fontWeight={UI_FONT_WEIGHT.semiBold}>
              {t("instruments.title")}
            </Text>
            <Text color="$color" opacity={UI_OPACITY.subtle} fontSize="$body">
              {active.length > 0
                ? t("instruments.manage") + ` (${active.length})`
                : t("instruments.description")}
            </Text>
          </YStack>
          <Button size="$compact" icon={Plus} onPress={handleAdd}>
            {t("instruments.add")}
          </Button>
        </XStack>

        {active.length === 0 ? (
          <Text color="$color" opacity={UI_OPACITY.subtle}>
            {t("instruments.empty")}
          </Text>
        ) : (
          <Accordion
            type="single"
            collapsible
            value={paymentInstrumentsSectionExpanded ? "payment-instruments" : undefined}
            onValueChange={(value) =>
              setPaymentInstrumentsExpanded(value === "payment-instruments")
            }
          >
            <Accordion.Item value="payment-instruments">
              <Accordion.Trigger
                bg="$backgroundHover"
                borderWidth={UI_BORDER_WIDTH.thin}
                borderColor="$borderColor"
                flexDirection="row"
                justify="space-between"
                items="center"
                px={UI_SPACE.section}
                py={UI_SPACE.section - 2}
                rounded={UI_RADIUS.chip}
              >
                {({ open }: { open: boolean }) => (
                  <>
                    <XStack
                      flexDirection="row"
                      items="center"
                      flex={1}
                      gap={UI_SPACE.control}
                    >
                      <Text fontWeight={UI_FONT_WEIGHT.medium}>
                        {t("instruments.manage")}
                      </Text>
                      <Text
                        fontSize="$caption"
                        color="$color"
                        opacity={UI_OPACITY.subtle}
                      >
                        ({active.length})
                      </Text>
                    </XStack>
                    {open ? (
                      <ChevronUp
                        size={UI_ICON_SIZE.medium}
                        color="$color"
                        opacity={UI_OPACITY.subtle}
                      />
                    ) : (
                      <ChevronDown
                        size={UI_ICON_SIZE.medium}
                        color="$color"
                        opacity={UI_OPACITY.subtle}
                      />
                    )}
                  </>
                )}
              </Accordion.Trigger>

              <Accordion.Content p={UI_SPACE.control} pt={UI_SPACE.section}>
                <YStack
                  gap="$gutter"
                  bg="$backgroundHover"
                  p="$section"
                  rounded={UI_RADIUS.surface}
                >
                  {(["Credit Card", "Debit Card", "UPI"] as const).map((method) => {
                    const list = grouped[method] ?? []
                    if (list.length === 0) return null
                    return (
                      <YStack key={method} gap="$section">
                        <Text
                          fontWeight={UI_FONT_WEIGHT.bold}
                          color="$color"
                          opacity={UI_OPACITY.faint}
                          fontSize="$caption"
                        >
                          {method}
                        </Text>
                        {list.map((inst) => (
                          <XStack
                            key={inst.id}
                            gap="$control"
                            bg="$background"
                            px="$section"
                            py="$section"
                            justify="space-between"
                            items="center"
                            rounded={UI_RADIUS.surface}
                          >
                            <Text flex={1} numberOfLines={1} color="$color" opacity={0.9}>
                              {formatPaymentInstrumentLabel(inst)}
                            </Text>
                            <Button
                              size="$chip"
                              chromeless
                              icon={Edit3}
                              onPress={() => handleEdit(inst)}
                              aria-label={t("common.editLabel", {
                                label: formatPaymentInstrumentLabel(inst),
                              })}
                            />
                            <Button
                              size="$chip"
                              chromeless
                              icon={Trash}
                              onPress={() => handleDelete(inst)}
                              aria-label={t("common.removeLabel", {
                                label: formatPaymentInstrumentLabel(inst),
                              })}
                            />
                          </XStack>
                        ))}
                      </YStack>
                    )
                  })}
                </YStack>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>
        )}
      </YStack>

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
