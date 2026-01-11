import { useCallback, useMemo, useState } from "react"
import { YStack, XStack, Text, Button, Label, Accordion } from "tamagui"
import { Alert, ViewStyle } from "react-native"
import { Plus, Edit3, Trash, ChevronDown } from "@tamagui/lucide-icons"
import { useSettings } from "../../../stores/hooks"
import type { PaymentInstrument } from "../../../types/payment-instrument"
import {
  formatPaymentInstrumentLabel,
  getActivePaymentInstruments,
} from "../../../services/payment-instruments"
import { PaymentInstrumentFormModal } from "../PaymentInstrumentFormModal"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []

const layoutStyles = {
  row: {
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  accordionTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
  } as ViewStyle,
  accordionTriggerInner: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  } as ViewStyle,
  accordionContent: {
    padding: 8,
    paddingTop: 12,
  } as ViewStyle,
}

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
  const {
    settings,
    updateSettings,
    paymentInstrumentsSectionExpanded,
    setPaymentInstrumentsExpanded,
  } = useSettings()

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
      Alert.alert("Remove Instrument", `Remove "${inst.nickname}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
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
      ])
    },
    [instruments, updateSettings]
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
      <YStack gap="$3">
        <XStack style={layoutStyles.row}>
          <YStack flex={1} gap="$1">
            <Label>Saved Instruments</Label>
            <Text color="$color" opacity={0.7} fontSize="$3">
              Add nicknames for your Credit/Debit cards and UPI IDs.
            </Text>
          </YStack>
          <Button size="$4" themeInverse icon={Plus} onPress={handleAdd}>
            Add
          </Button>
        </XStack>

        {active.length === 0 ? (
          <Text color="$color" opacity={0.6}>
            No instruments yet.
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
                style={layoutStyles.accordionTrigger}
              >
                {({ open }: { open: boolean }) => (
                  <>
                    <XStack style={layoutStyles.accordionTriggerInner}>
                      <Text fontWeight="500">Manage Instruments</Text>
                      <Text fontSize="$2" color="$color" opacity={0.6}>
                        ({active.length})
                      </Text>
                    </XStack>
                    <ChevronDown
                      size={18}
                      style={{
                        transform: [{ rotate: open ? "180deg" : "0deg" }],
                      }}
                    />
                  </>
                )}
              </Accordion.Trigger>

              <Accordion.Content style={layoutStyles.accordionContent}>
                <YStack gap="$4">
                  {(["Credit Card", "Debit Card", "UPI"] as const).map((method) => {
                    const list = grouped[method] ?? []
                    if (list.length === 0) return null
                    return (
                      <YStack key={method} gap="$2">
                        <Text fontWeight="700" color="$color" opacity={0.8}>
                          {method}
                        </Text>
                        {list.map((inst) => (
                          <XStack key={inst.id} gap="$2" style={layoutStyles.row}>
                            <Text flex={1} numberOfLines={1}>
                              {formatPaymentInstrumentLabel(inst)}
                            </Text>
                            <Button
                              size="$2"
                              chromeless
                              icon={Edit3}
                              onPress={() => handleEdit(inst)}
                              aria-label="Edit"
                            />
                            <Button
                              size="$2"
                              chromeless
                              icon={Trash}
                              onPress={() => handleDelete(inst)}
                              aria-label="Remove"
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
