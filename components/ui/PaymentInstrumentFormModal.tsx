import { useCallback, useMemo, useRef, useState } from "react"
import { YStack, XStack, Text, Input, Button, Label, Sheet, H4 } from "tamagui"
import { ViewStyle, Keyboard } from "react-native"
import { Check, X } from "@tamagui/lucide-icons"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { PaymentMethodCard } from "./PaymentMethodCard"
import type {
  PaymentInstrument,
  PaymentInstrumentMethod,
} from "../../types/payment-instrument"
import {
  generatePaymentInstrumentId,
  getLastDigitsLength,
  sanitizeLastDigits,
  validatePaymentInstrumentInput,
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
  contentContainer: {
    marginTop: 8,
  } as ViewStyle,
  methodRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  buttonRow: {
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  } as ViewStyle,
}

const INSTRUMENT_METHODS: PaymentInstrumentMethod[] = ["Credit Card", "Debit Card", "UPI"]

function getInstrumentMethodConfig(method: PaymentInstrumentMethod) {
  return PAYMENT_METHODS.find((pm) => pm.value === method)
}

interface PaymentInstrumentFormModalProps {
  open: boolean
  onClose: () => void
  existingInstruments: PaymentInstrument[]
  instrument?: PaymentInstrument
  initialMethod?: PaymentInstrumentMethod
  onSave: (instrument: PaymentInstrument) => void
}

export function PaymentInstrumentFormModal({
  open,
  onClose,
  existingInstruments,
  instrument,
  initialMethod,
  onSave,
}: PaymentInstrumentFormModalProps) {
  const isEditMode = !!instrument

  const [method, setMethod] = useState<PaymentInstrumentMethod>(
    instrument?.method ?? initialMethod ?? "Credit Card"
  )
  const [nickname, setNickname] = useState(instrument?.nickname ?? "")
  const [lastDigits, setLastDigits] = useState(instrument?.lastDigits ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const prevOpenRef = useRef(open)

  if (open && !prevOpenRef.current) {
    prevOpenRef.current = open
    const nextMethod = instrument?.method ?? initialMethod ?? "Credit Card"
    if (method !== nextMethod) setMethod(nextMethod)
    const nextNickname = instrument?.nickname ?? ""
    if (nickname !== nextNickname) setNickname(nextNickname)
    const nextLastDigits = instrument?.lastDigits ?? ""
    if (lastDigits !== nextLastDigits) setLastDigits(nextLastDigits)
    if (Object.keys(errors).length > 0) setErrors({})
  } else if (!open && prevOpenRef.current) {
    prevOpenRef.current = open
  }

  const selectedMethodConfig = useMemo(() => getInstrumentMethodConfig(method), [method])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleSelectMethod = useCallback(
    (next: PaymentInstrumentMethod) => {
      setMethod(next)
      setLastDigits("")
      if (errors.method || errors.lastDigits) {
        setErrors((prev) => {
          const { method: _m, lastDigits: _d, ...rest } = prev
          return rest
        })
      }
    },
    [errors.method, errors.lastDigits]
  )

  const handleNicknameChange = useCallback(
    (text: string) => {
      setNickname(text)
      if (errors.nickname) {
        setErrors((prev) => {
          const { nickname: _n, ...rest } = prev
          return rest
        })
      }
    },
    [errors.nickname]
  )

  const handleLastDigitsChange = useCallback(
    (text: string) => {
      const maxLen = getLastDigitsLength(method)
      setLastDigits(sanitizeLastDigits(text, maxLen))
      if (errors.lastDigits) {
        setErrors((prev) => {
          const { lastDigits: _d, ...rest } = prev
          return rest
        })
      }
    },
    [errors.lastDigits, method]
  )

  const handleSave = useCallback(() => {
    Keyboard.dismiss()

    const validation = validatePaymentInstrumentInput(
      { method, nickname, lastDigits },
      existingInstruments,
      instrument?.id
    )

    if (!validation.success) {
      setErrors(validation.errors)
      return
    }

    const now = new Date().toISOString()
    const normalizedNickname = nickname.trim()

    const next: PaymentInstrument = instrument
      ? {
          ...instrument,
          method,
          nickname: normalizedNickname,
          lastDigits,
          updatedAt: now,
        }
      : {
          id: generatePaymentInstrumentId(),
          method,
          nickname: normalizedNickname,
          lastDigits,
          createdAt: now,
          updatedAt: now,
        }

    onSave(next)
    onClose()
  }, [method, nickname, lastDigits, existingInstruments, instrument, onSave, onClose])

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

        <YStack gap="$4" style={layoutStyles.contentContainer}>
          <XStack style={layoutStyles.headerRow}>
            <H4>{isEditMode ? "Edit Instrument" : "Add Instrument"}</H4>
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
              Payment Method
            </Label>
            <XStack style={layoutStyles.methodRow}>
              {INSTRUMENT_METHODS.map((m) => {
                const config =
                  selectedMethodConfig && selectedMethodConfig.value === m
                    ? selectedMethodConfig
                    : PAYMENT_METHODS.find((pm) => pm.value === m)
                if (!config) return null
                return (
                  <PaymentMethodCard
                    key={m}
                    config={config}
                    isSelected={method === m}
                    onPress={() => handleSelectMethod(m)}
                  />
                )
              })}
            </XStack>
          </YStack>

          <YStack gap="$2">
            <Label color="$color" opacity={0.8}>
              Nickname
            </Label>
            <Input
              size="$4"
              placeholder="e.g., HDFC Visa"
              value={nickname}
              onChangeText={handleNicknameChange}
              maxLength={30}
              borderWidth={2}
              borderColor={errors.nickname ? "$red10" : "$borderColor"}
              focusStyle={{
                borderColor: errors.nickname ? "$red10" : ACCENT_COLORS.primary,
              }}
            />
            {errors.nickname && (
              <Text fontSize="$2" color="$red10">
                {errors.nickname}
              </Text>
            )}
          </YStack>

          <YStack gap="$2">
            <Label color="$color" opacity={0.8}>
              {selectedMethodConfig?.identifierLabel ?? "Last digits"}
            </Label>
            <Input
              size="$4"
              placeholder={`Enter ${getLastDigitsLength(method)} digits`}
              keyboardType="numeric"
              value={lastDigits}
              onChangeText={handleLastDigitsChange}
              maxLength={getLastDigitsLength(method)}
              borderWidth={2}
              borderColor={errors.lastDigits ? "$red10" : "$borderColor"}
              focusStyle={{
                borderColor: errors.lastDigits ? "$red10" : ACCENT_COLORS.primary,
              }}
            />
            {errors.lastDigits && (
              <Text fontSize="$2" color="$red10">
                {errors.lastDigits}
              </Text>
            )}
          </YStack>

          <XStack style={layoutStyles.buttonRow}>
            <Button size="$4" chromeless onPress={handleClose}>
              Cancel
            </Button>
            <Button
              size="$4"
              themeInverse
              onPress={handleSave}
              icon={<Check size="$1" />}
              fontWeight="bold"
            >
              {isEditMode ? "Save" : "Add"}
            </Button>
          </XStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}

export type { PaymentInstrumentFormModalProps }
