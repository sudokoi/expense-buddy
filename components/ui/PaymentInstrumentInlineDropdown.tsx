import React, { useCallback, useMemo, useState } from "react"
import { Button, Card, Input, Label, Text, View, XStack, YStack, useTheme } from "tamagui"
import { ChevronDown, ChevronUp, Plus } from "@tamagui/lucide-icons"
import { Pressable, TextStyle, ViewStyle } from "react-native"
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

// Only use style prop for layout properties that Tamagui View doesn't support directly
const styles = {
  menuRow: {
    minHeight: 44,
  } as ViewStyle,
  menuRowInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  } as ViewStyle,
  rowLabel: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 12,
    textAlign: "left",
  } as TextStyle,
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
      return `${method} • Saved instrument`
    }
    if (kind === "manual") {
      return manualDigits.trim()
        ? `${method} • Others (${manualDigits.trim()})`
        : `${method} • Others`
    }
    return "Select saved instrument (optional)"
  }, [kind, manualDigits, method, selectedInstrument])

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
    <YStack gap="$2">
      <Button
        size="$4"
        chromeless
        borderWidth={1}
        borderColor="$borderColor"
        background={open ? "$backgroundFocus" : "transparent"}
        onPress={() => setOpen((v) => !v)}
        icon={open ? ChevronUp : ChevronDown}
      >
        {headerLabel}
      </Button>

      {open && (
        <Card bordered padding="$1" borderRadius="$4" gap="$1">
          <Pressable
            onPress={handleSelectNone}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === "none" }}
            style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.8 : 1 }]}
          >
            <View
              borderWidth={1}
              borderColor={kind === "none" ? focusBorderColor : "$borderColor"}
              bg={kind === "none" ? "$backgroundFocus" : "$backgroundHover"}
              style={styles.menuRowInner}
            >
              <Text
                fontWeight={kind === "none" ? "700" : "500"}
                style={styles.rowLabel}
                numberOfLines={1}
              >
                None
              </Text>
              {kind === "none" && (
                <Text color={focusBorderColor} fontWeight="700">
                  Selected
                </Text>
              )}
              {kind !== "none" && (
                <Text opacity={0} fontWeight="700">
                  Selected
                </Text>
              )}
            </View>
          </Pressable>

          <Pressable
            onPress={handleSelectManual}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === "manual" }}
            style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.8 : 1 }]}
          >
            <View
              borderWidth={1}
              borderColor={kind === "manual" ? focusBorderColor : "$borderColor"}
              bg={kind === "manual" ? "$backgroundFocus" : "$backgroundHover"}
              style={styles.menuRowInner}
            >
              <Text
                fontWeight={kind === "manual" ? "700" : "500"}
                style={styles.rowLabel}
                numberOfLines={1}
              >
                Others / Enter digits
              </Text>
              {kind === "manual" && (
                <Text color={focusBorderColor} fontWeight="700">
                  Selected
                </Text>
              )}
              {kind !== "manual" && (
                <Text opacity={0} fontWeight="700">
                  Selected
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
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.8 : 1 }]}
              >
                <View
                  borderWidth={1}
                  borderColor={isSelected ? focusBorderColor : "$borderColor"}
                  bg={isSelected ? "$backgroundFocus" : "$backgroundHover"}
                  style={styles.menuRowInner}
                >
                  <Text
                    fontWeight={isSelected ? "700" : "500"}
                    style={styles.rowLabel}
                    numberOfLines={1}
                  >
                    {formatPaymentInstrumentLabel(inst)}
                  </Text>
                  {isSelected && (
                    <Text color={focusBorderColor} fontWeight="700">
                      Selected
                    </Text>
                  )}
                  {!isSelected && (
                    <Text opacity={0} fontWeight="700">
                      Selected
                    </Text>
                  )}
                </View>
              </Pressable>
            )
          })}

          {onCreateInstrument && (
            <Button
              size="$4"
              themeInverse
              icon={Plus}
              onPress={handleStartAdd}
              borderWidth={1}
              borderColor="$borderColor"
            >
              {showAdd ? "Cancel Add" : "Add saved"}
            </Button>
          )}
        </Card>
      )}

      {kind === "manual" && (
        <YStack gap="$1">
          <Label color="$color" opacity={0.6} fontSize="$2">
            {effectiveIdentifierLabel} (Optional)
          </Label>
          <Input
            size="$4"
            placeholder={`Enter ${effectiveMaxLength} digits`}
            keyboardType="numeric"
            value={manualDigits}
            onChangeText={handleManualDigitsChange}
            maxLength={effectiveMaxLength}
          />
        </YStack>
      )}

      {showAdd && onCreateInstrument && (
        <YStack
          gap="$2"
          borderWidth={1}
          borderColor="$borderColor"
          style={{ padding: 8, borderRadius: 12 }}
        >
          <YStack gap="$1">
            <Label color="$color" opacity={0.8}>
              Nickname
            </Label>
            <Input
              size="$4"
              placeholder="e.g., HDFC Visa"
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
              borderWidth={2}
              borderColor={addErrors.nickname ? "$red10" : "$borderColor"}
              focusStyle={{
                borderColor: addErrors.nickname ? "$red10" : focusBorderColor,
              }}
            />
            {addErrors.nickname && (
              <Text fontSize="$2" color="$red10">
                {addErrors.nickname}
              </Text>
            )}
          </YStack>

          <YStack gap="$1">
            <Label color="$color" opacity={0.8}>
              {effectiveIdentifierLabel}
            </Label>
            <Input
              size="$4"
              placeholder={`Enter ${getLastDigitsLength(method)} digits`}
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
              borderWidth={2}
              borderColor={addErrors.lastDigits ? "$red10" : "$borderColor"}
              focusStyle={{
                borderColor: addErrors.lastDigits ? "$red10" : focusBorderColor,
              }}
            />
            {addErrors.lastDigits && (
              <Text fontSize="$2" color="$red10">
                {addErrors.lastDigits}
              </Text>
            )}
          </YStack>

          <XStack gap="$2" style={{ justifyContent: "flex-end" }}>
            <Button size="$4" chromeless onPress={handleStartAdd}>
              Cancel
            </Button>
            <Button size="$4" themeInverse onPress={handleSaveNew}>
              Save
            </Button>
          </XStack>
        </YStack>
      )}
    </YStack>
  )
}
