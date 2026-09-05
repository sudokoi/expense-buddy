import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"
import { CompactControl } from "./CompactControl"
import { UI_ICON_SIZE } from "../../constants/ui-tokens"
import { Check, Plus } from "lucide-react-native"
import { Button } from "./Button"
import { Input } from "./Input"
import { Label } from "./Label"
import { useThemeColors } from "../../hooks/use-theme-colors"
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
import {
  getAvailableInstruments,
  resolveInstrumentChoice,
  type InstrumentEntry,
  type InstrumentEntryKind,
} from "../../utils/payment-instrument-entry"

export type { InstrumentEntryKind }

interface PaymentInstrumentInlineDropdownProps {
  method: PaymentInstrumentMethod
  instruments: PaymentInstrument[]
  kind: InstrumentEntryKind
  selectedInstrumentId?: string
  manualDigits: string
  identifierLabel?: string
  maxLength?: number
  onChange: (next: InstrumentEntry) => void
  onCreateInstrument?: (instrument: PaymentInstrument) => void
}

export function PaymentInstrumentInlineDropdown(
  props: PaymentInstrumentInlineDropdownProps
) {
  // Changing methods must not carry an unfinished new-card draft into another method.
  return <InstrumentEntryField key={props.method} {...props} />
}

function InstrumentEntryField({
  method,
  instruments,
  kind,
  selectedInstrumentId,
  manualDigits,
  maxLength,
  onChange,
  onCreateInstrument,
}: PaymentInstrumentInlineDropdownProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const [showAdd, setShowAdd] = useState(false)
  const [nickname, setNickname] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const available = useMemo(
    () => getAvailableInstruments(instruments, method),
    [instruments, method]
  )
  const selected = available.find((item) => item.id === selectedInstrumentId)
  const digitsCount = maxLength ?? getLastDigitsLength(method)
  const identifierLabel = t("instruments.form.digitsLabel", { count: digitsCount })
  const value = kind === "saved" ? `saved:${selectedInstrumentId}` : kind
  const options = [
    {
      value: "none",
      label: t("instruments.dropdown.none"),
      description: t("instruments.dropdown.noneHelp"),
    },
    ...available.map((item) => ({
      value: `saved:${item.id}`,
      label: item.nickname,
      description: `•••• ${item.lastDigits}`,
    })),
  ]
  const closeAdd = () => {
    setShowAdd(false)
    setNickname("")
    setErrors({})
  }
  const saveNew = () => {
    if (!onCreateInstrument) return
    const lastDigits = sanitizeLastDigits(manualDigits, getLastDigitsLength(method))
    const result = validatePaymentInstrumentInput(
      { method, nickname, lastDigits },
      instruments
    )
    if (!result.success) {
      setErrors(result.errors)
      return
    }
    const now = new Date().toISOString()
    const instrument: PaymentInstrument = {
      id: generatePaymentInstrumentId(),
      method,
      nickname: nickname.trim(),
      lastDigits,
      createdAt: now,
      updatedAt: now,
    }
    onCreateInstrument(instrument)
    onChange({
      kind: "saved",
      selectedInstrumentId: instrument.id,
      manualDigits: lastDigits,
    })
    closeAdd()
  }

  return (
    <View className="gap-3">
      <Label>{t("instruments.dropdown.saved")}</Label>
      {available.length > 0 || kind === "saved" ? (
        <View className="flex-row flex-wrap gap-2">
          {options.map((option) => (
            <CompactControl
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === option.value }}
              accessibilityLabel={`${option.label}, ${option.description}`}
              surfaceStyle={{
                flex: 1,
                backgroundColor: value === option.value ? theme.muted : theme.surface,
                borderColor: value === option.value ? theme.accent : theme.border,
              }}
              onPress={() => {
                if (value === option.value) return
                const next = resolveInstrumentChoice(option.value, available, {
                  kind,
                  selectedInstrumentId,
                  manualDigits,
                })
                if (next) {
                  onChange(next)
                  closeAdd()
                }
              }}
            >
              <View className="shrink gap-1">
                <Text className="text-sm font-medium text-foreground">
                  {option.label}
                </Text>
                {option.value !== "none" ? (
                  <Text className="text-xs text-muted-foreground">
                    {option.description}
                  </Text>
                ) : null}
              </View>
              {value === option.value ? (
                <Check size={UI_ICON_SIZE.mini} color={theme.accent} />
              ) : null}
            </CompactControl>
          ))}
        </View>
      ) : null}
      {kind === "saved" && !selected ? (
        <Text className="text-xs text-muted-foreground">
          {t("instruments.dropdown.unavailable")}.{" "}
          {t("instruments.dropdown.unavailableHelp")}
        </Text>
      ) : null}
      <View className="gap-1">
        <Label>
          {identifierLabel} {t("common.optional")}
        </Label>
        <Input
          value={manualDigits}
          onChangeText={(text) => {
            const digits = sanitizeLastDigits(text, digitsCount)
            setErrors((prev) => ({ ...prev, lastDigits: "" }))
            onChange({
              kind: digits ? "manual" : "none",
              selectedInstrumentId: undefined,
              manualDigits: digits,
            })
          }}
          keyboardType="number-pad"
          maxLength={digitsCount}
          accessibilityLabel={identifierLabel}
          className={errors.lastDigits ? "border-error" : undefined}
          placeholder={t("instruments.form.identifierPlaceholder", {
            count: digitsCount,
          })}
        />
        {errors.lastDigits ? (
          <Text className="text-xs text-error" accessibilityRole="alert">
            {errors.lastDigits}
          </Text>
        ) : null}
        {kind !== "saved" && !showAdd ? (
          <Text className="text-xs text-muted-foreground">
            {t("instruments.dropdown.manualHelp")}
          </Text>
        ) : null}
      </View>
      {onCreateInstrument && !showAdd ? (
        <Button
          variant="outline"
          icon={<Plus size={UI_ICON_SIZE.small} />}
          onPress={() => {
            setShowAdd(true)
          }}
        >
          {t("instruments.dropdown.addSaved")}
        </Button>
      ) : null}
      {showAdd && onCreateInstrument ? (
        <View className="gap-3 rounded-control border border-border bg-surface p-3">
          <Text className="text-sm font-semibold text-foreground">
            {t("instruments.dropdown.addSaved")}
          </Text>
          <View className="gap-1">
            <Label>{t("instruments.form.nickname")}</Label>
            <Input
              value={nickname}
              onChangeText={(text) => {
                setNickname(text)
                setErrors((prev) => ({ ...prev, nickname: "" }))
              }}
              accessibilityLabel={t("instruments.form.nickname")}
              placeholder={t("instruments.form.nicknamePlaceholder")}
              maxLength={30}
              className={errors.nickname ? "border-error" : undefined}
            />
            {errors.nickname ? (
              <Text className="text-xs text-error" accessibilityRole="alert">
                {errors.nickname}
              </Text>
            ) : null}
          </View>
          <View className="flex-row gap-2">
            <Button className="flex-1" onPress={closeAdd}>
              {t("common.cancel")}
            </Button>
            <Button className="flex-1" variant="accent" onPress={saveNew}>
              {t("instruments.form.addTitle")}
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  )
}
