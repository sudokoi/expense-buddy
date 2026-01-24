import { useCallback, useMemo, useState } from "react"
import { YStack, XStack, Text, Input, Button, Label } from "tamagui"
import { ViewStyle, Keyboard } from "react-native"
import { Check } from "@tamagui/lucide-icons"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { useTranslation } from "react-i18next"
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
import { AppSheetScaffold } from "./AppSheetScaffold"

const layoutStyles = {
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
  const { t } = useTranslation()
  const isEditMode = !!instrument

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const formKey = `${instrument?.id ?? "new"}:${initialMethod ?? ""}`

  return (
    <AppSheetScaffold
      open={open}
      onClose={handleClose}
      title={
        isEditMode
          ? t("settings.instruments.form.editTitle")
          : t("settings.instruments.form.addTitle")
      }
      snapPoints={[90]}
    >
      {open ? (
        <PaymentInstrumentForm
          key={formKey}
          onClose={handleClose}
          existingInstruments={existingInstruments}
          instrument={instrument}
          initialMethod={initialMethod}
          onSave={onSave}
        />
      ) : null}
    </AppSheetScaffold>
  )
}

function PaymentInstrumentForm({
  onClose,
  existingInstruments,
  instrument,
  initialMethod,
  onSave,
}: {
  onClose: () => void
  existingInstruments: PaymentInstrument[]
  instrument?: PaymentInstrument
  initialMethod?: PaymentInstrumentMethod
  onSave: (instrument: PaymentInstrument) => void
}) {
  const isEditMode = !!instrument

  const [method, setMethod] = useState<PaymentInstrumentMethod>(
    instrument?.method ?? initialMethod ?? "Credit Card"
  )
  const [nickname, setNickname] = useState(instrument?.nickname ?? "")
  const [lastDigits, setLastDigits] = useState(instrument?.lastDigits ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { t } = useTranslation()

  const selectedMethodConfig = useMemo(() => getInstrumentMethodConfig(method), [method])

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
    <YStack gap="$4">
      <YStack gap="$2">
        <Label color="$color" opacity={0.8}>
          {t("settings.instruments.form.paymentMethod")}
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
          {t("settings.instruments.form.nickname")}
        </Label>
        <Input
          size="$4"
          placeholder={t("settings.instruments.form.nicknamePlaceholder")}
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
          {selectedMethodConfig?.identifierLabel ??
            t("settings.instruments.form.lastDigits")}
        </Label>
        <Input
          size="$4"
          placeholder={t("settings.instruments.form.identifierPlaceholder", {
            count: getLastDigitsLength(method),
          })}
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
        <Button size="$4" chromeless onPress={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          size="$4"
          themeInverse
          onPress={handleSave}
          icon={<Check size="$1" />}
          fontWeight="bold"
        >
          {isEditMode ? t("common.save") : t("common.add")}
        </Button>
      </XStack>
    </YStack>
  )
}

export type { PaymentInstrumentFormModalProps }
