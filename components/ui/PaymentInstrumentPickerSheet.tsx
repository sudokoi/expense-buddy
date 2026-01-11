import { useCallback, useMemo, useState } from "react"
import {
  YStack,
  XStack,
  Text,
  Input,
  Button,
  Label,
  Sheet,
  H4,
  ScrollView,
} from "tamagui"
import { ViewStyle } from "react-native"
import { X, Plus } from "@tamagui/lucide-icons"
import type {
  PaymentInstrument,
  PaymentInstrumentMethod,
} from "../../types/payment-instrument"
import {
  formatPaymentInstrumentLabel,
  getActivePaymentInstruments,
} from "../../services/payment-instruments"
import { ACCENT_COLORS } from "../../constants/theme-colors"

const layoutStyles = {
  sheetFrame: {
    padding: 16,
  } as ViewStyle,
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  listItem: {
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
}

interface PaymentInstrumentPickerSheetProps {
  open: boolean
  onClose: () => void
  method: PaymentInstrumentMethod
  instruments: PaymentInstrument[]
  selectedInstrumentId?: string
  onSelectInstrument: (instrument: PaymentInstrument) => void
  onSelectOthers: () => void
  onAddNew?: () => void
}

export function PaymentInstrumentPickerSheet({
  open,
  onClose,
  method,
  instruments,
  selectedInstrumentId,
  onSelectInstrument,
  onSelectOthers,
  onAddNew,
}: PaymentInstrumentPickerSheetProps) {
  const [query, setQuery] = useState("")

  const active = useMemo(() => getActivePaymentInstruments(instruments), [instruments])

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return active
      .filter((i) => i.method === method)
      .filter((i) =>
        q ? formatPaymentInstrumentLabel(i).toLowerCase().includes(q) : true
      )
      .sort((a, b) => a.nickname.localeCompare(b.nickname))
  }, [active, method, query])

  const handleClose = useCallback(() => {
    setQuery("")
    onClose()
  }, [onClose])

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) handleClose()
      }}
      snapPoints={[90]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Frame style={layoutStyles.sheetFrame} bg="$background">
        <Sheet.Handle />

        <YStack gap="$3">
          <XStack style={layoutStyles.headerRow}>
            <H4>Select {method}</H4>
            <Button
              size="$3"
              chromeless
              icon={X}
              onPress={handleClose}
              aria-label="Close"
            />
          </XStack>

          <YStack gap="$2">
            <Label color="$color" opacity={0.8}>
              Search
            </Label>
            <Input
              size="$4"
              placeholder="Search by nickname or digits"
              value={query}
              onChangeText={setQuery}
              borderWidth={2}
              borderColor="$borderColor"
              focusStyle={{ borderColor: ACCENT_COLORS.primary }}
            />
          </YStack>

          <XStack gap="$2">
            <Button flex={1} size="$4" onPress={onSelectOthers}>
              Others / Enter Manually
            </Button>
            {onAddNew && (
              <Button size="$4" themeInverse icon={Plus} onPress={onAddNew}>
                Add
              </Button>
            )}
          </XStack>

          <ScrollView flex={1} showsVerticalScrollIndicator={false}>
            <YStack gap="$2">
              {options.length === 0 ? (
                <Text color="$color" opacity={0.6}>
                  No saved instruments.
                </Text>
              ) : (
                options.map((inst) => {
                  const isSelected = inst.id === selectedInstrumentId
                  return (
                    <Button
                      key={inst.id}
                      size="$4"
                      onPress={() => onSelectInstrument(inst)}
                      chromeless
                      borderWidth={1}
                      borderColor={isSelected ? ACCENT_COLORS.primary : "$borderColor"}
                    >
                      <XStack flex={1} style={layoutStyles.listItem}>
                        <Text fontWeight={isSelected ? "700" : "500"}>
                          {formatPaymentInstrumentLabel(inst)}
                        </Text>
                        {isSelected && (
                          <Text color={ACCENT_COLORS.primary} fontWeight="700">
                            Selected
                          </Text>
                        )}
                      </XStack>
                    </Button>
                  )
                })
              )}
            </YStack>
          </ScrollView>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}

export type { PaymentInstrumentPickerSheetProps }
