import React, { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button, Card, Input, Label, Text, View, XStack, YStack, useTheme } from "tamagui"
import { ChevronDown, ChevronUp, Plus } from "@tamagui/lucide-icons-2"
import { Pressable } from "react-native"
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
import { getColorValue } from "../../tamagui.config"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
} from "../../constants/ui-tokens"
import { ACCENT_COLORS } from "../../constants/theme-colors"

// Only use style prop for layout properties that Tamagui View doesn't support directly
const styles = {
  menuRow: {
    minHeight: 44,
  },
  rowLabel: {
    flex: 1,
    flexShrink: 1,
    paddingRight: UI_SPACE.section,
    textAlign: "left",
  },
} as const

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

  const theme = useTheme()
  const focusBorderColor = getColorValue(theme.borderColorFocus)

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
    <YStack gap="$control">
      <Button
        size="$control"
        chromeless
        borderWidth={UI_BORDER_WIDTH.thin}
        borderColor="$borderColor"
        background={open ? "$backgroundFocus" : "transparent"}
        onPress={() => setOpen((v) => !v)}
        icon={open ? ChevronUp : ChevronDown}
      >
        {headerLabel}
      </Button>

      {open && (
        <Card
          borderWidth={UI_BORDER_WIDTH.thin}
          borderColor="$borderColor"
          p="$micro"
          rounded="$control"
          gap="$micro"
        >
          <Pressable
            onPress={handleSelectNone}
            role="button"
            aria-selected={kind === "none"}
            style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.8 : 1 }]}
          >
            <View
              borderWidth={UI_BORDER_WIDTH.thin}
              borderColor={kind === "none" ? focusBorderColor : "$borderColor"}
              bg={kind === "none" ? "$backgroundFocus" : "$backgroundHover"}
              flexDirection="row"
              items="center"
              justify="space-between"
              py={UI_SPACE.section}
              px={UI_SPACE.section}
              rounded={UI_RADIUS.chip}
            >
              <Text
                fontWeight={kind === "none" ? UI_FONT_WEIGHT.bold : UI_FONT_WEIGHT.medium}
                style={styles.rowLabel}
                numberOfLines={1}
              >
                {t("instruments.dropdown.none")}
              </Text>
              {kind === "none" && (
                <Text color={focusBorderColor} fontWeight={UI_FONT_WEIGHT.bold}>
                  {t("instruments.dropdown.selected")}
                </Text>
              )}
              {kind !== "none" && (
                <Text opacity={UI_OPACITY.hidden} fontWeight={UI_FONT_WEIGHT.bold}>
                  {t("instruments.dropdown.selected")}
                </Text>
              )}
            </View>
          </Pressable>

          <Pressable
            onPress={handleSelectManual}
            role="button"
            aria-selected={kind === "manual"}
            style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.8 : 1 }]}
          >
            <View
              borderWidth={UI_BORDER_WIDTH.thin}
              borderColor={kind === "manual" ? focusBorderColor : "$borderColor"}
              bg={kind === "manual" ? "$backgroundFocus" : "$backgroundHover"}
              flexDirection="row"
              items="center"
              justify="space-between"
              py={UI_SPACE.section}
              px={UI_SPACE.section}
              rounded={UI_RADIUS.chip}
            >
              <Text
                fontWeight={
                  kind === "manual" ? UI_FONT_WEIGHT.bold : UI_FONT_WEIGHT.medium
                }
                style={styles.rowLabel}
                numberOfLines={1}
              >
                {t("instruments.dropdown.others")}
              </Text>
              {kind === "manual" && (
                <Text color={focusBorderColor} fontWeight={UI_FONT_WEIGHT.bold}>
                  {t("instruments.dropdown.selected")}
                </Text>
              )}
              {kind !== "manual" && (
                <Text opacity={UI_OPACITY.hidden} fontWeight={UI_FONT_WEIGHT.bold}>
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
                style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.8 : 1 }]}
              >
                <View
                  borderWidth={UI_BORDER_WIDTH.thin}
                  borderColor={isSelected ? focusBorderColor : "$borderColor"}
                  bg={isSelected ? "$backgroundFocus" : "$backgroundHover"}
                  flexDirection="row"
                  items="center"
                  justify="space-between"
                  py={UI_SPACE.section}
                  px={UI_SPACE.section}
                  rounded={UI_RADIUS.chip}
                >
                  <Text
                    fontWeight={isSelected ? UI_FONT_WEIGHT.bold : UI_FONT_WEIGHT.medium}
                    style={styles.rowLabel}
                    numberOfLines={1}
                  >
                    {formatPaymentInstrumentLabel(inst)}
                  </Text>
                  {isSelected && (
                    <Text color={focusBorderColor} fontWeight={UI_FONT_WEIGHT.bold}>
                      {t("instruments.dropdown.selected")}
                    </Text>
                  )}
                  {!isSelected && (
                    <Text opacity={UI_OPACITY.hidden} fontWeight={UI_FONT_WEIGHT.bold}>
                      {t("instruments.dropdown.selected")}
                    </Text>
                  )}
                </View>
              </Pressable>
            )
          })}

          {onCreateInstrument && (
            <Button
              size="$control"
              theme="accent"
              icon={Plus}
              onPress={handleStartAdd}
              borderWidth={UI_BORDER_WIDTH.thin}
              borderColor="$borderColor"
            >
              {showAdd
                ? t("instruments.dropdown.cancelAdd")
                : t("instruments.dropdown.addSaved")}
            </Button>
          )}
        </Card>
      )}

      {kind === "manual" && (
        <YStack gap="$micro">
          <Label color="$color" opacity={UI_OPACITY.subtle} fontSize="$caption">
            {effectiveIdentifierLabel} (Optional)
          </Label>
          <Input
            size="$control"
            bg="$background"
            borderWidth={UI_BORDER_WIDTH.normal}
            borderColor="$borderColor"
            focusStyle={{
              borderColor: ACCENT_COLORS.primary,
            }}
            placeholder={t("settings.instruments.form.identifierPlaceholder", {
              count: effectiveMaxLength,
            })}
            keyboardType="numeric"
            value={manualDigits}
            onChangeText={handleManualDigitsChange}
            maxLength={effectiveMaxLength}
          />
        </YStack>
      )}

      {showAdd && onCreateInstrument && (
        <YStack
          gap="$control"
          borderWidth={UI_BORDER_WIDTH.thin}
          borderColor="$borderColor"
          style={{ padding: UI_SPACE.control, borderRadius: UI_RADIUS.chip }}
        >
          <YStack gap="$micro">
            <Label color="$color" opacity={UI_OPACITY.strong}>
              {t("instruments.form.nickname")}
            </Label>
            <Input
              size="$control"
              bg="$background"
              placeholder={t("instruments.form.nicknamePlaceholder")}
              value={nickname}
              onChangeText={(t) => {
                setNickname(t)
                if (addErrors.nickname) {
                  setAddErrors((prev) => {
                    const { nickname: _n, ...rest } = prev
                    return rest
                  })
                }
              }}
              maxLength={30}
              borderWidth={UI_BORDER_WIDTH.normal}
              borderColor={addErrors.nickname ? "$red10" : "$borderColor"}
              focusStyle={{
                borderColor: addErrors.nickname ? "$red10" : focusBorderColor,
              }}
            />
            {addErrors.nickname && (
              <Text fontSize="$caption" color="$red10">
                {addErrors.nickname}
              </Text>
            )}
          </YStack>

          <YStack gap="$micro">
            <Label color="$color" opacity={UI_OPACITY.strong}>
              {effectiveIdentifierLabel}
            </Label>
            <Input
              size="$control"
              bg="$background"
              placeholder={t("settings.instruments.form.identifierPlaceholder", {
                count: getLastDigitsLength(method),
              })}
              keyboardType="numeric"
              value={newLastDigits}
              onChangeText={(t) => {
                const expectedLen = getLastDigitsLength(method)
                setNewLastDigits(sanitizeLastDigits(t, expectedLen))
                if (addErrors.lastDigits) {
                  setAddErrors((prev) => {
                    const { lastDigits: _d, ...rest } = prev
                    return rest
                  })
                }
              }}
              maxLength={getLastDigitsLength(method)}
              borderWidth={UI_BORDER_WIDTH.normal}
              borderColor={addErrors.lastDigits ? "$red10" : "$borderColor"}
              focusStyle={{
                borderColor: addErrors.lastDigits ? "$red10" : focusBorderColor,
              }}
            />
            {addErrors.lastDigits && (
              <Text fontSize="$caption" color="$red10">
                {addErrors.lastDigits}
              </Text>
            )}
          </YStack>

          <XStack gap="$control" style={{ justifyContent: "flex-end" }}>
            <Button size="$control" chromeless onPress={handleStartAdd}>
              {t("common.cancel")}
            </Button>
            <Button size="$control" theme="accent" onPress={handleSaveNew}>
              {t("common.save")}
            </Button>
          </XStack>
        </YStack>
      )}
    </YStack>
  )
}
