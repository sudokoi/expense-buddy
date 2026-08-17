import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"
import { ChevronDown, ChevronUp, Plus } from "lucide-react-native"
import { Button } from "./Button"
import { Card } from "./Card"
import { Input } from "./Input"
import { Label } from "./Label"
import type {
  PaymentInstrument,
  PaymentInstrumentMethod,
} from "../../types/payment-instrument"
import {
  formatPaymentInstrumentLabel,
  generatePaymentInstrumentId,
  getActivePaymentInstruments,
  getLastDigitsLength,
  sanitizeLastDigits,
  validatePaymentInstrumentInput,
} from "../../services/payment-instruments"
import { validateIdentifier } from "../../utils/payment-method-validation"
import { UI_RADIUS, UI_SPACE } from "../../constants/ui-tokens"

export type InstrumentEntryKind = "none" | "manual" | "saved"

interface PaymentInstrumentInlineDropdownProps {
  method: PaymentInstrumentMethod
  instruments: PaymentInstrument[]

  kind: InstrumentEntryKind
  selectedInstrumentId?: string
  manualDigits: string

  identifierLabel?: string
  maxLength?: number

  onChange: (next: {
    kind: InstrumentEntryKind
    selectedInstrumentId?: string
    manualDigits: string
  }) => void

  onCreateInstrument?: (instrument: PaymentInstrument) => void
}

export function PaymentInstrumentInlineDropdown({
  method,
  instruments,
  kind,
  selectedInstrumentId,
  manualDigits,
  identifierLabel,
  maxLength,
  onChange,
  onCreateInstrument,
}: PaymentInstrumentInlineDropdownProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const effectiveMaxLength = maxLength ?? getLastDigitsLength(method)
  const effectiveIdentifierLabel = identifierLabel ?? `Last ${effectiveMaxLength} digits`

  const [nickname, setNickname] = useState("")
  const [newLastDigits, setNewLastDigits] = useState("")
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})

  const activeForMethod = useMemo(() => {
    return getActivePaymentInstruments(instruments)
      .filter((i) => i.method === method)
      .sort((a, b) => a.nickname.localeCompare(b.nickname))
  }, [instruments, method])

  const selectedInstrument = useMemo(() => {
    if (!selectedInstrumentId) return undefined
    return instruments.find((i) => i.id === selectedInstrumentId)
  }, [instruments, selectedInstrumentId])

  const headerLabel = useMemo(() => {
    if (kind === "saved") {
      if (selectedInstrument && !selectedInstrument.deletedAt) {
        return formatPaymentInstrumentLabel(selectedInstrument)
      }
      return `${method} • ${t("instruments.dropdown.saved")}`
    }
    if (kind === "manual") {
      return manualDigits.trim()
        ? t("instruments.dropdown.othersLabelWithDigits", {
            method,
            digits: manualDigits.trim(),
          })
        : t("instruments.dropdown.othersLabel", { method })
    }
    return t("instruments.dropdown.selectSaved")
  }, [kind, manualDigits, method, selectedInstrument, t])

  const closeDropdown = useCallback(() => setOpen(false), [])

  const resetAddForm = useCallback(() => {
    setNickname("")
    setNewLastDigits("")
    setAddErrors({})
  }, [])

  const handleSelectNone = useCallback(() => {
    onChange({ kind: "none", selectedInstrumentId: undefined, manualDigits: "" })
    setShowAdd(false)
    resetAddForm()
    closeDropdown()
  }, [closeDropdown, onChange, resetAddForm])

  const handleSelectManual = useCallback(() => {
    const nextDigits = kind === "manual" ? manualDigits : ""
    onChange({
      kind: "manual",
      selectedInstrumentId: undefined,
      manualDigits: nextDigits,
    })
    setShowAdd(false)
    resetAddForm()
    closeDropdown()
  }, [closeDropdown, kind, manualDigits, onChange, resetAddForm])

  const handleSelectInstrument = useCallback(
    (inst: PaymentInstrument) => {
      onChange({
        kind: "saved",
        selectedInstrumentId: inst.id,
        manualDigits: inst.lastDigits,
      })
      setShowAdd(false)
      resetAddForm()
      closeDropdown()
    },
    [closeDropdown, onChange, resetAddForm]
  )

  const handleManualDigitsChange = useCallback(
    (text: string) => {
      onChange({
        kind: "manual",
        selectedInstrumentId: undefined,
        manualDigits: validateIdentifier(text, effectiveMaxLength),
      })
    },
    [effectiveMaxLength, onChange]
  )

  const handleStartAdd = useCallback(() => {
    setShowAdd((prev) => {
      const next = !prev
      if (next) {
        // Prefer pre-filling last digits from manual entry if available.
        const expectedLen = getLastDigitsLength(method)
        const seed = sanitizeLastDigits(manualDigits, expectedLen)
        setNewLastDigits(seed)
      } else {
        resetAddForm()
      }
      return next
    })
  }, [manualDigits, method, resetAddForm])

  const handleSaveNew = useCallback(() => {
    if (!onCreateInstrument) return

    const expectedLen = getLastDigitsLength(method)
    const validation = validatePaymentInstrumentInput(
      {
        method,
        nickname,
        lastDigits: sanitizeLastDigits(newLastDigits, expectedLen),
      },
      instruments
    )

    if (!validation.success) {
      setAddErrors(validation.errors)
      return
    }

    const now = new Date().toISOString()
    const inst: PaymentInstrument = {
      id: generatePaymentInstrumentId(),
      method,
      nickname: nickname.trim(),
      lastDigits: sanitizeLastDigits(newLastDigits, expectedLen),
      createdAt: now,
      updatedAt: now,
    }

    onCreateInstrument(inst)
    onChange({
      kind: "saved",
      selectedInstrumentId: inst.id,
      manualDigits: inst.lastDigits,
    })
    setShowAdd(false)
    resetAddForm()
  }, [
    instruments,
    method,
    nickname,
    newLastDigits,
    onChange,
    onCreateInstrument,
    resetAddForm,
  ])

  return (
    <View className="gap-2">
      <Button
        size="control"
        variant="ghost"
        className={
          open ? "gap-2 border border-border bg-muted" : "gap-2 border border-border"
        }
        onPress={() => setOpen((v) => !v)}
      >
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {headerLabel}
      </Button>

      {open && (
        <Card className="gap-1 p-1 rounded-control">
          <Pressable
            onPress={handleSelectNone}
            role="button"
            aria-selected={kind === "none"}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            className="min-h-[44]"
          >
            <View
              className={`flex-row items-center justify-between py-3 px-3 rounded-chip border ${
                kind === "none" ? "border-accent bg-muted" : "border-border bg-surface"
              }`}
            >
              <Text
                className={`flex-1 shrink pr-3 text-left ${kind === "none" ? "font-bold" : "font-medium"}`}
                numberOfLines={1}
              >
                {t("instruments.dropdown.none")}
              </Text>
              {kind === "none" && (
                <Text className="font-bold text-accent">
                  {t("instruments.dropdown.selected")}
                </Text>
              )}
              {kind !== "none" && (
                <Text className="font-bold opacity-0">
                  {t("instruments.dropdown.selected")}
                </Text>
              )}
            </View>
          </Pressable>

          <Pressable
            onPress={handleSelectManual}
            role="button"
            aria-selected={kind === "manual"}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            className="min-h-[44]"
          >
            <View
              className={`flex-row items-center justify-between py-3 px-3 rounded-chip border ${
                kind === "manual" ? "border-accent bg-muted" : "border-border bg-surface"
              }`}
            >
              <Text
                className={`flex-1 shrink pr-3 text-left ${kind === "manual" ? "font-bold" : "font-medium"}`}
                numberOfLines={1}
              >
                {t("instruments.dropdown.others")}
              </Text>
              {kind === "manual" && (
                <Text className="font-bold text-accent">
                  {t("instruments.dropdown.selected")}
                </Text>
              )}
              {kind !== "manual" && (
                <Text className="font-bold opacity-0">
                  {t("instruments.dropdown.selected")}
                </Text>
              )}
            </View>
          </Pressable>

          {activeForMethod.map((inst) => {
            const isSelected = kind === "saved" && inst.id === selectedInstrumentId
            return (
              <Pressable
                key={inst.id}
                onPress={() => handleSelectInstrument(inst)}
                role="button"
                aria-selected={isSelected}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                className="min-h-[44]"
              >
                <View
                  className={`flex-row items-center justify-between py-3 px-3 rounded-chip border ${
                    isSelected ? "border-accent bg-muted" : "border-border bg-surface"
                  }`}
                >
                  <Text
                    className={`flex-1 shrink pr-3 text-left ${isSelected ? "font-bold" : "font-medium"}`}
                    numberOfLines={1}
                  >
                    {formatPaymentInstrumentLabel(inst)}
                  </Text>
                  {isSelected && (
                    <Text className="font-bold text-accent">
                      {t("instruments.dropdown.selected")}
                    </Text>
                  )}
                  {!isSelected && (
                    <Text className="font-bold opacity-0">
                      {t("instruments.dropdown.selected")}
                    </Text>
                  )}
                </View>
              </Pressable>
            )
          })}

          {onCreateInstrument && (
            <Button
              size="control"
              variant="accent"
              className="gap-2 border border-border"
              onPress={handleStartAdd}
            >
              <Plus size={16} />
              {showAdd
                ? t("instruments.dropdown.cancelAdd")
                : t("instruments.dropdown.addSaved")}
            </Button>
          )}
        </Card>
      )}

      {kind === "manual" && (
        <View className="gap-1">
          <Label className="text-xs opacity-60">
            {effectiveIdentifierLabel} {t("common.optional")}
          </Label>
          <Input
            placeholder={t("instruments.form.identifierPlaceholder", {
              count: effectiveMaxLength,
            })}
            keyboardType="numeric"
            value={manualDigits}
            onChangeText={handleManualDigitsChange}
            maxLength={effectiveMaxLength}
          />
        </View>
      )}

      {showAdd && onCreateInstrument && (
        <View
          className="gap-2 border border-border"
          style={{ padding: UI_SPACE.control, borderRadius: UI_RADIUS.chip }}
        >
          <View className="gap-1">
            <Label className="opacity-80">{t("instruments.form.nickname")}</Label>
            <Input
              className={addErrors.nickname ? "border-error" : undefined}
              placeholder={t("instruments.form.nicknamePlaceholder")}
              value={nickname}
              onChangeText={(text) => {
                setNickname(text)
                if (addErrors.nickname) {
                  setAddErrors((prev) => {
                    const { nickname: _n, ...rest } = prev
                    return rest
                  })
                }
              }}
              maxLength={30}
            />
            {addErrors.nickname && (
              <Text className="text-xs text-error">{addErrors.nickname}</Text>
            )}
          </View>

          <View className="gap-1">
            <Label className="opacity-80">{effectiveIdentifierLabel}</Label>
            <Input
              className={addErrors.lastDigits ? "border-error" : undefined}
              placeholder={t("instruments.form.identifierPlaceholder", {
                count: getLastDigitsLength(method),
              })}
              keyboardType="numeric"
              value={newLastDigits}
              onChangeText={(text) => {
                const expectedLen = getLastDigitsLength(method)
                setNewLastDigits(sanitizeLastDigits(text, expectedLen))
                if (addErrors.lastDigits) {
                  setAddErrors((prev) => {
                    const { lastDigits: _d, ...rest } = prev
                    return rest
                  })
                }
              }}
              maxLength={getLastDigitsLength(method)}
            />
            {addErrors.lastDigits && (
              <Text className="text-xs text-error">{addErrors.lastDigits}</Text>
            )}
          </View>

          <View className="flex-row gap-2" style={{ justifyContent: "flex-end" }}>
            <Button size="control" variant="ghost" onPress={handleStartAdd}>
              {t("common.cancel")}
            </Button>
            <Button size="control" variant="accent" onPress={handleSaveNew}>
              {t("common.save")}
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
