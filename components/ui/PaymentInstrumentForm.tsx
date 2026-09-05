import { useCallback, useMemo, useState } from "react"
import { UI_ICON_SIZE } from "../../constants/ui-tokens"
import { Keyboard, Text, View } from "react-native"
import { Check } from "lucide-react-native"
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
  PAYMENT_INSTRUMENT_METHODS,
  sanitizeLastDigits,
  validatePaymentInstrumentInput,
} from "../../services/payment-instruments"
import { Button } from "./Button"
import { Input } from "./Input"
import { Label } from "./Label"

function getInstrumentMethodConfig(method: PaymentInstrumentMethod) {
  return PAYMENT_METHODS.find((pm) => pm.value === method)
}

interface PaymentInstrumentFormProps {
  onClose: () => void
  existingInstruments: PaymentInstrument[]
  instrument?: PaymentInstrument
  initialMethod?: PaymentInstrumentMethod
  onSave: (instrument: PaymentInstrument) => void
}

/** Mount with a key for the edited instrument so a different row starts a fresh draft. */
export function PaymentInstrumentForm({
  onClose,
  existingInstruments,
  instrument,
  initialMethod,
  onSave,
}: PaymentInstrumentFormProps) {
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
    <View className="gap-4">
      <View className="gap-2">
        <Label className="opacity-80">{t("instruments.form.paymentMethod")}</Label>
        <View className="flex-row flex-wrap gap-2">
          {PAYMENT_INSTRUMENT_METHODS.map((m) => {
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
        </View>
      </View>

      <View className="gap-2">
        <Label className="opacity-80">{t("instruments.form.nickname")}</Label>
        <Input
          className={errors.nickname ? "border-error" : undefined}
          placeholder={t("instruments.form.nicknamePlaceholder")}
          value={nickname}
          accessibilityLabel={t("instruments.form.nickname")}
          onChangeText={handleNicknameChange}
          maxLength={30}
        />
        {errors.nickname && <Text className="text-xs text-error">{errors.nickname}</Text>}
      </View>

      <View className="gap-2">
        <Label className="opacity-80">
          {t("instruments.form.digitsLabel", { count: getLastDigitsLength(method) })}
        </Label>
        <Input
          className={errors.lastDigits ? "border-error" : undefined}
          placeholder={t("instruments.form.identifierPlaceholder", {
            count: getLastDigitsLength(method),
          })}
          keyboardType="numeric"
          value={lastDigits}
          accessibilityLabel={t("instruments.form.lastDigits")}
          onChangeText={handleLastDigitsChange}
          maxLength={getLastDigitsLength(method)}
        />
        {errors.lastDigits && (
          <Text className="text-xs text-error">{errors.lastDigits}</Text>
        )}
      </View>

      <View className="flex-row justify-end gap-3 mt-2">
        <Button size="control" variant="ghost" onPress={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          size="control"
          variant="accent"
          icon={<Check size={UI_ICON_SIZE.medium} />}
          onPress={handleSave}
        >
          {isEditMode ? t("common.save") : t("common.add")}
        </Button>
      </View>
    </View>
  )
}

export type { PaymentInstrumentFormProps }
