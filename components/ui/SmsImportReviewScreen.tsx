import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import Animated, { FadeIn, FadeOutUp, LinearTransition } from "react-native-reanimated"
import { Alert, Text, View } from "react-native"
import { Button } from "./Button"
import { Card } from "./Card"
import { Input } from "./Input"
import { Label } from "./Label"
import {
  type PaymentMethod,
  PaymentMethodType,
  type Expense,
  type ExpenseCategory,
} from "../../types/expense"
import type { Category } from "../../types/category"
import type { PaymentInstrument } from "../../types/payment-instrument"
import { getPaymentMethodI18nKey, PAYMENT_METHODS } from "../../constants/payment-methods"
import {
  useCategories,
  useExpenses,
  useNotifications,
  useSettings,
} from "../../stores/hooks"
import { useSmsImportReview } from "../../providers/sms-import-review-provider"
import {
  findInstrumentById,
  formatPaymentInstrumentLabel,
  isPaymentInstrumentMethod,
} from "../../services/payment-instruments"
import {
  resolveSmsImportCategory,
  resolveSmsImportPaymentSuggestion,
} from "../../services/sms-import/suggestion-resolver"
import { parseNumericAmount } from "../../utils/amount-input"
import { type SmsImportReviewItem } from "../../types/sms-import"
import { validateIdentifier } from "../../utils/payment-method-validation"
import { CategoryCard } from "./CategoryCard"
import { PaymentMethodCard } from "./PaymentMethodCard"
import type { PaymentInstrumentMethod } from "../../types/payment-instrument"
import {
  InstrumentEntryKind,
  PaymentInstrumentInlineDropdown,
} from "./PaymentInstrumentInlineDropdown"
import {
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_DURATION,
} from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"

type EditableSmsImportDraft = {
  amount: string
  category: ExpenseCategory
  note: string
  paymentMethodType?: PaymentMethodType
  paymentMethodIdentifier?: string
  paymentInstrumentId?: string
  instrumentEntryKind: InstrumentEntryKind
}

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function getLocalizedCategoryLabel(
  label: ExpenseCategory,
  t: (key: string) => string
): string {
  return label === "Other" ? t("settings.categories.other") : label
}

function getLocalizedPaymentMethodLabel(
  paymentMethod: SmsImportReviewItem["paymentMethodSuggestion"] | undefined,
  paymentInstruments: PaymentInstrument[],
  t: (key: string) => string
): string {
  if (!paymentMethod?.type) {
    return t("paymentMethods.other")
  }

  const methodLabel = t(`paymentMethods.${getPaymentMethodI18nKey(paymentMethod.type)}`)
  const instrument = findInstrumentById(paymentInstruments, paymentMethod.instrumentId)

  if (!instrument) {
    return methodLabel
  }

  return `${methodLabel} • ${formatPaymentInstrumentLabel(instrument)}`
}

function getLocalizedReviewStatus(
  status: SmsImportReviewItem["status"],
  t: (key: string) => string
): string {
  switch (status) {
    case "pending":
      return t("smsImport.sheet.statuses.pending")
    case "accepted":
      return t("smsImport.sheet.statuses.accepted")
    case "rejected":
      return t("smsImport.sheet.statuses.rejected")
    case "dismissed":
      return t("smsImport.sheet.statuses.dismissed")
  }
}

function formatSuggestionDebugText(
  item: SmsImportReviewItem,
  t: (key: string) => string
): string | null {
  if (!item.categorySuggestionSource) {
    return null
  }

  const parts = [
    `${t("smsImport.sheet.debug.source")}: ${
      item.categorySuggestionSource === "ml"
        ? t("smsImport.sheet.debug.sourceMl")
        : t("smsImport.sheet.debug.sourceRegex")
    }`,
  ]

  if (
    item.categorySuggestionSource === "ml" &&
    typeof item.categorySuggestionConfidence === "number"
  ) {
    parts.push(
      `${t("smsImport.sheet.debug.confidence")}: ${Math.round(
        item.categorySuggestionConfidence * 100
      )}%`
    )
  }

  if (item.categorySuggestionSource === "ml" && item.categorySuggestionModelId) {
    parts.push(`${t("smsImport.sheet.debug.model")}: ${item.categorySuggestionModelId}`)
  }

  return parts.join(" • ")
}

function resolveCategoryLabel(
  item: SmsImportReviewItem,
  availableCategories: Category[]
): ExpenseCategory {
  return resolveSmsImportCategory(item, availableCategories)
}

function createDraftFromItem(
  item: SmsImportReviewItem,
  availableCategories: Category[],
  paymentInstruments: PaymentInstrument[]
): EditableSmsImportDraft {
  const resolvedPaymentSuggestion = resolveSmsImportPaymentSuggestion(
    item,
    paymentInstruments
  )

  return {
    amount:
      typeof item.amount === "number" && Number.isFinite(item.amount)
        ? String(item.amount)
        : "",
    category: resolveCategoryLabel(item, availableCategories),
    note: item.noteSuggestion ?? item.merchantName ?? "",
    paymentMethodType: resolvedPaymentSuggestion?.type ?? "Other",
    paymentMethodIdentifier: resolvedPaymentSuggestion?.identifier,
    paymentInstrumentId: resolvedPaymentSuggestion?.instrumentId,
    instrumentEntryKind: resolvedPaymentSuggestion?.instrumentId
      ? "saved"
      : resolvedPaymentSuggestion?.identifier
        ? "manual"
        : "none",
  }
}

function buildExpenseFromDraft(
  item: SmsImportReviewItem,
  draft: EditableSmsImportDraft,
  defaultCurrency: string
): Omit<Expense, "id" | "createdAt" | "updatedAt"> | null {
  const parsedAmount = parseNumericAmount(draft.amount, { allowZero: false })
  if (!parsedAmount.success || parsedAmount.value === undefined) {
    return null
  }

  return {
    amount: parsedAmount.value,
    currency: item.currency ?? defaultCurrency,
    category: draft.category,
    date: item.transactionDate ?? item.sourceMessage.receivedAt,
    note: draft.note.trim(),
    paymentMethod: draft.paymentMethodType
      ? {
          type: draft.paymentMethodType,
          identifier: draft.paymentMethodIdentifier,
          instrumentId: draft.paymentInstrumentId,
        }
      : undefined,
  }
}

export function SmsImportReviewScreen({
  initialFocusItemId,
}: {
  initialFocusItemId?: string | null
}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const theme = useThemeColors()
  const { categories } = useCategories()
  const { settings, updateSettings } = useSettings()
  const paymentInstruments = settings.paymentInstruments ?? EMPTY_INSTRUMENTS
  const { addExpenses } = useExpenses()
  const { addNotification } = useNotifications()
  const {
    items,
    pendingItems,
    resolvedItems,
    markItemAccepted,
    markItemsAccepted,
    markItemsRejected,
    markItemRejected,
    dismissItem,
    clearResolvedItems,
  } = useSmsImportReview()

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<EditableSmsImportDraft | null>(null)
  const [showResolvedItems, setShowResolvedItems] = useState(false)
  const scrollViewRef = useRef<React.ElementRef<typeof KeyboardAwareScrollView>>(null)
  const resolvedSuggestions = useMemo(() => {
    const map = new Map<
      string,
      { category: ExpenseCategory; paymentMethod: PaymentMethod | undefined }
    >()
    for (const item of pendingItems) {
      map.set(item.id, {
        category: resolveCategoryLabel(item, categories),
        paymentMethod: resolveSmsImportPaymentSuggestion(item, paymentInstruments),
      })
    }
    return map
  }, [pendingItems, categories, paymentInstruments])
  const handledInitialFocusIdRef = useRef<string | null>(null)

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId) ?? null,
    [items, editingItemId]
  )

  const closeEditor = useCallback(() => {
    setEditingItemId(null)
    setEditingDraft(null)
  }, [])

  const openEditor = useCallback(
    (item: SmsImportReviewItem) => {
      setEditingItemId(item.id)
      setEditingDraft(createDraftFromItem(item, categories, paymentInstruments))
    },
    [categories, paymentInstruments]
  )

  useEffect(() => {
    if (!initialFocusItemId) {
      handledInitialFocusIdRef.current = null
      return
    }

    if (handledInitialFocusIdRef.current === initialFocusItemId) {
      return
    }

    const focusedItem = pendingItems.find(
      (item) => item.id === initialFocusItemId || item.fingerprint === initialFocusItemId
    )
    if (!focusedItem) {
      return
    }

    handledInitialFocusIdRef.current = initialFocusItemId
    requestAnimationFrame(() => {
      openEditor(focusedItem)
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo?.({ y: 0, animated: true })
      })
    })
  }, [initialFocusItemId, openEditor, pendingItems])

  const acceptItem = useCallback(
    (item: SmsImportReviewItem, draft: EditableSmsImportDraft) => {
      const expenseDraft = buildExpenseFromDraft(
        item,
        draft,
        settings.defaultCurrency || "INR"
      )

      if (!expenseDraft) {
        addNotification(t("smsImport.sheet.notifications.invalidAmount"), "error")
        return false
      }

      addExpenses([expenseDraft])
      markItemAccepted(item.fingerprint)
      addNotification(t("smsImport.sheet.notifications.importedOne"), "success")
      return true
    },
    [addExpenses, addNotification, markItemAccepted, settings.defaultCurrency, t]
  )
  const handleAcceptSuggested = useCallback(
    (item: SmsImportReviewItem) => {
      void acceptItem(item, createDraftFromItem(item, categories, paymentInstruments))
    },
    [acceptItem, categories, paymentInstruments]
  )

  const handleAcceptEdited = useCallback(() => {
    if (!editingItem || !editingDraft) {
      return
    }

    const accepted = acceptItem(editingItem, editingDraft)
    if (accepted) {
      closeEditor()
    }
  }, [acceptItem, closeEditor, editingDraft, editingItem])

  const handleAcceptAllSuggested = useCallback(() => {
    const acceptedPairs = pendingItems
      .map((item) => ({
        item,
        expense: buildExpenseFromDraft(
          item,
          createDraftFromItem(item, categories, paymentInstruments),
          settings.defaultCurrency || "INR"
        ),
      }))
      .filter(
        (
          pair
        ): pair is {
          item: SmsImportReviewItem
          expense: Omit<Expense, "id" | "createdAt" | "updatedAt">
        } => pair.expense !== null
      )

    if (acceptedPairs.length === 0) {
      addNotification(t("smsImport.sheet.notifications.noPendingReady"), "error")
      return
    }

    addExpenses(acceptedPairs.map((pair) => pair.expense))

    markItemsAccepted(acceptedPairs.map((pair) => pair.item.fingerprint))

    if (acceptedPairs.length === pendingItems.length) {
      addNotification(
        acceptedPairs.length === 1
          ? t("smsImport.sheet.notifications.importedOne")
          : t("smsImport.sheet.notifications.importedMany", {
              count: acceptedPairs.length,
            }),
        "success"
      )
    } else {
      addNotification(
        t("smsImport.sheet.notifications.importedPartial", {
          count: acceptedPairs.length,
        }),
        "info"
      )
    }
  }, [
    addExpenses,
    addNotification,
    categories,
    markItemsAccepted,
    pendingItems,
    paymentInstruments,
    settings.defaultCurrency,
    t,
  ])

  const handleRejectAllSuggested = useCallback(() => {
    if (pendingItems.length === 0) {
      addNotification(t("smsImport.sheet.notifications.noPendingReady"), "error")
      return
    }

    Alert.alert(
      t("smsImport.sheet.rejectAllDialogTitle"),
      t("smsImport.sheet.rejectAllDialogMessage", { count: pendingItems.length }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("smsImport.sheet.rejectAllConfirm"),
          style: "destructive",
          onPress: () => {
            markItemsRejected(pendingItems.map((item) => item.fingerprint))
            addNotification(
              t("smsImport.sheet.notifications.rejectedMany", {
                count: pendingItems.length,
              }),
              "info"
            )
          },
        },
      ]
    )
  }, [addNotification, markItemsRejected, pendingItems, t])

  const subtitle = useMemo(() => {
    if (editingItem) {
      return t("smsImport.sheet.subtitle.editing")
    }

    if (pendingItems.length > 0 && resolvedItems.length > 0) {
      return t("smsImport.sheet.subtitle.pendingAndResolved", {
        pendingCount: pendingItems.length,
        resolvedCount: resolvedItems.length,
      })
    }

    if (pendingItems.length > 0) {
      return t("smsImport.sheet.subtitle.pendingOnly", {
        count: pendingItems.length,
      })
    }

    if (resolvedItems.length > 0) {
      return t("smsImport.sheet.subtitle.resolvedOnly", {
        count: resolvedItems.length,
      })
    }

    return t("smsImport.sheet.emptyDescription")
  }, [editingItem, pendingItems.length, resolvedItems.length, t])

  const selectedPaymentConfig = editingDraft?.paymentMethodType
    ? (PAYMENT_METHODS.find((pm) => pm.value === editingDraft.paymentMethodType) ?? null)
    : null

  const handlePaymentMethodSelect = useCallback((type: PaymentMethodType) => {
    setEditingDraft((current) =>
      current
        ? {
            ...current,
            paymentMethodType: type,
            paymentMethodIdentifier: undefined,
            paymentInstrumentId: undefined,
            instrumentEntryKind: "none",
          }
        : current
    )
  }, [])

  const handleIdentifierChange = useCallback(
    (text: string) => {
      setEditingDraft((current) => {
        if (!current) {
          return current
        }

        if (current.paymentMethodType === "Other") {
          const maxLen = selectedPaymentConfig?.maxLength || 50
          return {
            ...current,
            paymentMethodIdentifier: text.slice(0, maxLen),
          }
        }

        const maxLen = selectedPaymentConfig?.maxLength || 4
        return {
          ...current,
          paymentMethodIdentifier: validateIdentifier(text, maxLen),
          paymentInstrumentId: undefined,
          instrumentEntryKind:
            current.paymentMethodType &&
            isPaymentInstrumentMethod(current.paymentMethodType)
              ? "manual"
              : current.instrumentEntryKind,
        }
      })
    },
    [selectedPaymentConfig?.maxLength]
  )

  const footer = editingItem ? (
    <View className="flex-row justify-end gap-2">
      <Button onPress={closeEditor}>{t("common.cancel")}</Button>
      <Button variant="accent" onPress={handleAcceptEdited}>
        {t("smsImport.sheet.footer.saveAndImport")}
      </Button>
    </View>
  ) : pendingItems.length > 1 ? (
    <View className="flex-row flex-wrap justify-between gap-2">
      <Button onPress={() => setShowResolvedItems((current) => !current)}>
        {showResolvedItems
          ? t("smsImport.sheet.footer.hideResolved")
          : t("smsImport.sheet.footer.showResolved")}
      </Button>
      <Button variant="destructive" onPress={handleRejectAllSuggested}>
        {t("smsImport.sheet.footer.rejectAllSuggested")}
      </Button>
      <Button variant="accent" onPress={handleAcceptAllSuggested}>
        {t("smsImport.sheet.footer.acceptAllSuggested")}
      </Button>
    </View>
  ) : resolvedItems.length > 0 ? (
    <View className="flex-row justify-between gap-2">
      <Button onPress={() => setShowResolvedItems((current) => !current)}>
        {showResolvedItems
          ? t("smsImport.sheet.footer.hideResolved")
          : t("smsImport.sheet.footer.showResolved")}
      </Button>
      <Button onPress={clearResolvedItems}>
        {t("smsImport.sheet.footer.clearResolved")}
      </Button>
    </View>
  ) : (
    <View className="flex-row justify-end">
      <Button onPress={() => router.back()}>{t("common.done")}</Button>
    </View>
  )

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={96}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View
          className="w-full gap-4 px-4 pt-4 pb-4"
          style={{ maxWidth: UI_SPACE.empty * 18, alignSelf: "center" }}
        >
          <Card className="p-3">
            <View className="gap-2">
              <Text className="text-lg font-semibold text-foreground">
                {editingItem
                  ? t("smsImport.sheet.editTitle")
                  : t("smsImport.sheet.title")}
              </Text>
              <Text
                className="text-[13px] text-foreground"
                style={{ opacity: UI_OPACITY.medium }}
              >
                {subtitle}
              </Text>
            </View>
          </Card>

          {editingItem && editingDraft ? (
            <View className="gap-4 pb-2">
              <Card className="p-3">
                <View className="gap-2">
                  <Text
                    className="text-foreground"
                    style={{ fontWeight: UI_FONT_WEIGHT.bold }}
                  >
                    {t("smsImport.sheet.sourceSms")}
                  </Text>
                  <Text
                    className="text-[13px] text-foreground"
                    style={{ opacity: UI_OPACITY.medium }}
                  >
                    {editingItem.sourceMessage.sender ||
                      t("smsImport.sheet.unknownSender")}
                  </Text>
                  <Text
                    className="text-xs text-foreground"
                    style={{ opacity: UI_OPACITY.subtle }}
                  >
                    {formatTimestamp(editingItem.sourceMessage.receivedAt)}
                  </Text>
                  <Text className="text-foreground">
                    {editingItem.sourceMessage.body}
                  </Text>
                </View>
              </Card>

              <View className="gap-2">
                <Label>{t("smsImport.sheet.fields.amount")}</Label>
                <Input
                  keyboardType="numeric"
                  value={editingDraft.amount}
                  onChangeText={(amount) => {
                    setEditingDraft((current) =>
                      current
                        ? {
                            ...current,
                            amount,
                          }
                        : current
                    )
                  }}
                  placeholderTextColor={theme.foreground}
                />
              </View>

              <View className="gap-2">
                <Label>{t("smsImport.sheet.fields.category")}</Label>
                <View className="flex-row flex-wrap gap-2">
                  {categories.map((category) => (
                    <CategoryCard
                      key={category.label}
                      compact
                      isSelected={editingDraft.category === category.label}
                      categoryColor={category.color}
                      label={category.label}
                      onPress={() => {
                        setEditingDraft((current) =>
                          current
                            ? {
                                ...current,
                                category: category.label,
                              }
                            : current
                        )
                      }}
                    />
                  ))}
                </View>
              </View>

              <View className="gap-2">
                <Label>{t("smsImport.sheet.fields.paymentMethod")}</Label>
                <View className="flex-row flex-wrap gap-2">
                  {PAYMENT_METHODS.map((config) => (
                    <PaymentMethodCard
                      key={config.value}
                      config={config}
                      isSelected={editingDraft.paymentMethodType === config.value}
                      onPress={() => handlePaymentMethodSelect(config.value)}
                    />
                  ))}
                </View>

                {selectedPaymentConfig?.hasIdentifier ? (
                  <View className="mt-2 gap-1">
                    <Label className="text-xs" style={{ opacity: UI_OPACITY.subtle }}>
                      {selectedPaymentConfig.identifierLabel ||
                        t("history.editDialog.fields.identifier")}{" "}
                      {t("common.optional")}
                    </Label>

                    {editingDraft.paymentMethodType &&
                    isPaymentInstrumentMethod(editingDraft.paymentMethodType) ? (
                      <PaymentInstrumentInlineDropdown
                        method={editingDraft.paymentMethodType as PaymentInstrumentMethod}
                        instruments={paymentInstruments}
                        kind={
                          editingDraft.paymentInstrumentId
                            ? "saved"
                            : editingDraft.instrumentEntryKind === "manual"
                              ? "manual"
                              : "none"
                        }
                        selectedInstrumentId={editingDraft.paymentInstrumentId}
                        manualDigits={editingDraft.paymentMethodIdentifier ?? ""}
                        identifierLabel={selectedPaymentConfig.identifierLabel}
                        maxLength={selectedPaymentConfig.maxLength}
                        onChange={(next) => {
                          setEditingDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  instrumentEntryKind: next.kind,
                                  paymentInstrumentId: next.selectedInstrumentId,
                                  paymentMethodIdentifier: next.manualDigits,
                                }
                              : current
                          )
                        }}
                        onCreateInstrument={(inst) => {
                          updateSettings({
                            paymentInstruments: [inst, ...paymentInstruments],
                          })
                        }}
                      />
                    ) : (
                      <Input
                        placeholder={
                          editingDraft.paymentMethodType === "Other"
                            ? t("history.editDialog.fields.otherPlaceholder")
                            : t("history.editDialog.fields.identifierPlaceholder", {
                                max: selectedPaymentConfig.maxLength,
                              })
                        }
                        keyboardType={
                          editingDraft.paymentMethodType === "Other"
                            ? "default"
                            : "numeric"
                        }
                        value={editingDraft.paymentMethodIdentifier ?? ""}
                        onChangeText={handleIdentifierChange}
                        maxLength={selectedPaymentConfig.maxLength}
                        placeholderTextColor={theme.foreground}
                      />
                    )}
                  </View>
                ) : null}
              </View>

              <View className="gap-2">
                <Label>{t("smsImport.sheet.fields.note")}</Label>
                <Input
                  value={editingDraft.note}
                  onChangeText={(note) => {
                    setEditingDraft((current) =>
                      current
                        ? {
                            ...current,
                            note,
                          }
                        : current
                    )
                  }}
                  selectTextOnFocus
                  placeholderTextColor={theme.foreground}
                />
              </View>

              <View
                className="border-t border-border pt-3"
                style={{ paddingBottom: Math.max(insets.bottom, UI_SPACE.gutter) }}
              >
                {footer}
              </View>
            </View>
          ) : items.length === 0 ? (
            <Card className="p-4">
              <View className="gap-2">
                <Text
                  className="text-foreground"
                  style={{ fontWeight: UI_FONT_WEIGHT.bold }}
                >
                  {t("smsImport.sheet.emptyTitle")}
                </Text>
                <Text className="text-foreground" style={{ opacity: UI_OPACITY.medium }}>
                  {t("smsImport.sheet.emptyDescription")}
                </Text>
              </View>
            </Card>
          ) : (
            <View className="gap-4 pb-2">
              {pendingItems.length > 0 ? (
                <View className="gap-3">
                  <Text
                    className="text-foreground"
                    style={{ fontWeight: UI_FONT_WEIGHT.bold }}
                  >
                    {t("smsImport.sheet.sectionTitles.pendingReview")}
                  </Text>

                  {pendingItems.map((item) => (
                    <Animated.View
                      key={item.id}
                      layout={LinearTransition.duration(UI_DURATION.instant)}
                      entering={FadeIn.duration(UI_DURATION.instant)}
                      exiting={FadeOutUp.duration(UI_DURATION.subtle)}
                    >
                      <Card className="p-3">
                        <View className="gap-3">
                          <View className="gap-1">
                            <Text
                              className="text-foreground"
                              style={{ fontWeight: UI_FONT_WEIGHT.bold }}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {item.merchantName || item.sourceMessage.sender}
                            </Text>
                            <Text
                              className="text-xs text-foreground"
                              style={{ opacity: UI_OPACITY.subtle }}
                            >
                              {formatTimestamp(item.sourceMessage.receivedAt)}
                            </Text>
                          </View>

                          <View className="gap-1">
                            {formatSuggestionDebugText(item, t) ? (
                              <Text
                                className="text-[11px] text-foreground"
                                style={{ opacity: UI_OPACITY.faint }}
                              >
                                {formatSuggestionDebugText(item, t)}
                              </Text>
                            ) : null}
                            <Text className="text-foreground">
                              {t("smsImport.sheet.labels.amount")}:{" "}
                              {typeof item.amount === "number"
                                ? `${item.currency || settings.defaultCurrency || "INR"} ${item.amount}`
                                : t("smsImport.sheet.values.needsReview")}
                            </Text>
                            <Text className="text-foreground">
                              {t("smsImport.sheet.labels.category")}:{" "}
                              {getLocalizedCategoryLabel(
                                resolvedSuggestions.get(item.id)?.category ??
                                  item.categorySuggestion ??
                                  t("settings.categories.other"),
                                t
                              )}
                            </Text>
                            <Text className="text-foreground">
                              {t("smsImport.sheet.labels.payment")}:{" "}
                              {getLocalizedPaymentMethodLabel(
                                resolvedSuggestions.get(item.id)?.paymentMethod,
                                paymentInstruments,
                                t
                              )}
                            </Text>
                            <Text
                              className="text-foreground"
                              numberOfLines={3}
                              style={{ opacity: UI_OPACITY.medium }}
                            >
                              {item.sourceMessage.body}
                            </Text>
                          </View>

                          <View className="flex-row flex-wrap gap-2">
                            <Button
                              variant="accent"
                              onPress={() => handleAcceptSuggested(item)}
                            >
                              {t("smsImport.sheet.actions.accept")}
                            </Button>
                            <Button onPress={() => openEditor(item)}>
                              {t("common.edit")}
                            </Button>
                            <Button
                              variant="destructive"
                              onPress={() => markItemRejected(item.fingerprint)}
                            >
                              {t("smsImport.sheet.actions.reject")}
                            </Button>
                            <Button onPress={() => dismissItem(item.fingerprint)}>
                              {t("smsImport.sheet.actions.dismiss")}
                            </Button>
                          </View>
                        </View>
                      </Card>
                    </Animated.View>
                  ))}
                </View>
              ) : null}

              {resolvedItems.length > 0 && showResolvedItems ? (
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="text-foreground"
                      style={{ fontWeight: UI_FONT_WEIGHT.bold }}
                    >
                      {t("smsImport.sheet.sectionTitles.resolved")}
                    </Text>
                    <Button size="compact" onPress={clearResolvedItems}>
                      {t("smsImport.sheet.footer.clearResolved")}
                    </Button>
                  </View>

                  {resolvedItems.map((item) => (
                    <Animated.View
                      key={item.id}
                      layout={LinearTransition.duration(UI_DURATION.instant)}
                      entering={FadeIn.duration(UI_DURATION.instant)}
                    >
                      <Card className="p-3" style={{ opacity: UI_OPACITY.strong }}>
                        <View className="gap-2">
                          <Text
                            className="text-foreground"
                            style={{ fontWeight: UI_FONT_WEIGHT.bold }}
                          >
                            {item.merchantName || item.sourceMessage.sender}
                          </Text>
                          <Text
                            className="text-xs text-foreground"
                            style={{ opacity: UI_OPACITY.subtle }}
                          >
                            {formatTimestamp(item.sourceMessage.receivedAt)}
                          </Text>
                          <Text className="text-foreground">
                            {t("smsImport.sheet.labels.status")}:{" "}
                            {getLocalizedReviewStatus(item.status, t)}
                          </Text>
                          <Text
                            className="text-foreground"
                            numberOfLines={2}
                            style={{ opacity: UI_OPACITY.medium }}
                          >
                            {item.sourceMessage.body}
                          </Text>
                        </View>
                      </Card>
                    </Animated.View>
                  ))}
                </View>
              ) : null}

              {pendingItems.length === 0 &&
              resolvedItems.length > 0 &&
              !showResolvedItems ? (
                <Card className="p-3">
                  <Text
                    className="text-foreground"
                    style={{ opacity: UI_OPACITY.medium }}
                  >
                    {t("smsImport.sheet.emptyResolved")}
                  </Text>
                </Card>
              ) : null}
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>

      {editingItem ? null : (
        <View
          className="border-t border-border bg-background px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, UI_SPACE.gutter) }}
        >
          <View
            className="w-full"
            style={{ maxWidth: UI_SPACE.empty * 18, alignSelf: "center" }}
          >
            {footer}
          </View>
        </View>
      )}
    </View>
  )
}
