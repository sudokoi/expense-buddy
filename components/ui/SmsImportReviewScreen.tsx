import { useCallback, useMemo, useState } from "react"
import type { ViewStyle } from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import Animated, { FadeIn, FadeOutUp, LinearTransition } from "react-native-reanimated"
import { Button, Card, H4, Input, Label, Text, TextArea, XStack, YStack } from "tamagui"
import {
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
  useSmsImportReview,
} from "../../stores/hooks"
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

const layoutStyles = {
  container: {
    alignSelf: "center",
    maxWidth: 720,
    width: "100%",
  } as ViewStyle,
  categoryRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  paymentMethodRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  identifierContainer: {
    marginTop: 8,
  } as ViewStyle,
  actionRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
} as const

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

export function SmsImportReviewScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
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
    markItemRejected,
    dismissItem,
    clearResolvedItems,
  } = useSmsImportReview()

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<EditableSmsImportDraft | null>(null)
  const [showResolvedItems, setShowResolvedItems] = useState(false)

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

      const [createdExpense] = addExpenses([expenseDraft])
      markItemAccepted(item.id, createdExpense?.id)
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

    const createdExpenses = addExpenses(acceptedPairs.map((pair) => pair.expense))

    markItemsAccepted(
      acceptedPairs.map((pair, index) => ({
        id: pair.item.id,
        acceptedExpenseId: createdExpenses[index]?.id,
      }))
    )

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
    <XStack justify="flex-end" gap="$2">
      <Button onPress={closeEditor}>{t("common.cancel")}</Button>
      <Button themeInverse onPress={handleAcceptEdited}>
        {t("smsImport.sheet.footer.saveAndImport")}
      </Button>
    </XStack>
  ) : pendingItems.length > 1 ? (
    <XStack justify="space-between" gap="$2">
      <Button onPress={() => setShowResolvedItems((current) => !current)}>
        {showResolvedItems
          ? t("smsImport.sheet.footer.hideResolved")
          : t("smsImport.sheet.footer.showResolved")}
      </Button>
      <Button themeInverse onPress={handleAcceptAllSuggested}>
        {t("smsImport.sheet.footer.acceptAllSuggested")}
      </Button>
    </XStack>
  ) : resolvedItems.length > 0 ? (
    <XStack justify="space-between" gap="$2">
      <Button onPress={() => setShowResolvedItems((current) => !current)}>
        {showResolvedItems
          ? t("smsImport.sheet.footer.hideResolved")
          : t("smsImport.sheet.footer.showResolved")}
      </Button>
      <Button onPress={clearResolvedItems}>
        {t("smsImport.sheet.footer.clearResolved")}
      </Button>
    </XStack>
  ) : (
    <XStack justify="flex-end">
      <Button onPress={() => router.back()}>{t("common.done")}</Button>
    </XStack>
  )

  return (
    <YStack flex={1} bg="$background">
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={96}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <YStack gap="$4" px="$4" pt="$4" pb="$4" style={layoutStyles.container}>
          <Card bordered padding="$3" backgroundColor="$backgroundHover">
            <YStack gap="$2">
              <H4>
                {editingItem
                  ? t("smsImport.sheet.editTitle")
                  : t("smsImport.sheet.title")}
              </H4>
              <Text fontSize="$3" opacity={0.7}>
                {subtitle}
              </Text>
            </YStack>
          </Card>

          {editingItem && editingDraft ? (
            <YStack gap="$4" pb="$2">
              <Card bordered padding="$3" backgroundColor="$backgroundHover">
                <YStack gap="$2">
                  <Text fontWeight="700">{t("smsImport.sheet.sourceSms")}</Text>
                  <Text fontSize="$3" opacity={0.7}>
                    {editingItem.sourceMessage.sender ||
                      t("smsImport.sheet.unknownSender")}
                  </Text>
                  <Text fontSize="$2" opacity={0.6}>
                    {formatTimestamp(editingItem.sourceMessage.receivedAt)}
                  </Text>
                  <Text>{editingItem.sourceMessage.body}</Text>
                </YStack>
              </Card>

              <YStack gap="$2">
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
                />
              </YStack>

              <YStack gap="$2">
                <Label>{t("smsImport.sheet.fields.category")}</Label>
                <XStack style={layoutStyles.categoryRow}>
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
                </XStack>
              </YStack>

              <YStack gap="$2">
                <Label>{t("smsImport.sheet.fields.paymentMethod")}</Label>
                <XStack style={layoutStyles.paymentMethodRow}>
                  {PAYMENT_METHODS.map((config) => (
                    <PaymentMethodCard
                      key={config.value}
                      config={config}
                      isSelected={editingDraft.paymentMethodType === config.value}
                      onPress={() => handlePaymentMethodSelect(config.value)}
                    />
                  ))}
                </XStack>

                {selectedPaymentConfig?.hasIdentifier ? (
                  <YStack gap="$1" style={layoutStyles.identifierContainer}>
                    <Label color="$color" opacity={0.6} fontSize="$2">
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
                        size="$4"
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
                      />
                    )}
                  </YStack>
                ) : null}
              </YStack>

              <YStack gap="$2">
                <Label>{t("smsImport.sheet.fields.note")}</Label>
                <TextArea
                  minH={100}
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
                />
              </YStack>

              <YStack
                borderTopWidth={1}
                borderColor="$borderColor"
                pt="$3"
                style={{ paddingBottom: Math.max(insets.bottom, 16) }}
              >
                {footer}
              </YStack>
            </YStack>
          ) : items.length === 0 ? (
            <Card bordered padding="$4" backgroundColor="$backgroundHover">
              <YStack gap="$2">
                <Text fontWeight="700">{t("smsImport.sheet.emptyTitle")}</Text>
                <Text opacity={0.75}>{t("smsImport.sheet.emptyDescription")}</Text>
              </YStack>
            </Card>
          ) : (
            <YStack gap="$4" pb="$2">
              {pendingItems.length > 0 ? (
                <YStack gap="$3">
                  <Text fontWeight="700">
                    {t("smsImport.sheet.sectionTitles.pendingReview")}
                  </Text>

                  {pendingItems.map((item) => (
                    <Animated.View
                      key={item.id}
                      layout={LinearTransition.duration(160)}
                      entering={FadeIn.duration(160)}
                      exiting={FadeOutUp.duration(180)}
                    >
                      <Card bordered padding="$3">
                        <YStack gap="$3">
                          <YStack gap="$1">
                            <Text fontWeight="700">
                              {item.merchantName || item.sourceMessage.sender}
                            </Text>
                            <Text fontSize="$2" opacity={0.6}>
                              {formatTimestamp(item.sourceMessage.receivedAt)}
                            </Text>
                          </YStack>

                          <YStack gap="$1">
                            {formatSuggestionDebugText(item, t) ? (
                              <Text fontSize="$1" opacity={0.55}>
                                {formatSuggestionDebugText(item, t)}
                              </Text>
                            ) : null}
                            <Text>
                              {t("smsImport.sheet.labels.amount")}:{" "}
                              {typeof item.amount === "number"
                                ? `${item.currency || settings.defaultCurrency || "INR"} ${item.amount}`
                                : t("smsImport.sheet.values.needsReview")}
                            </Text>
                            <Text>
                              {t("smsImport.sheet.labels.category")}:{" "}
                              {getLocalizedCategoryLabel(
                                resolveCategoryLabel(item, categories),
                                t
                              )}
                            </Text>
                            <Text>
                              {t("smsImport.sheet.labels.payment")}:{" "}
                              {getLocalizedPaymentMethodLabel(
                                resolveSmsImportPaymentSuggestion(
                                  item,
                                  paymentInstruments
                                ),
                                paymentInstruments,
                                t
                              )}
                            </Text>
                            <Text numberOfLines={3} opacity={0.75}>
                              {item.sourceMessage.body}
                            </Text>
                          </YStack>

                          <XStack style={layoutStyles.actionRow}>
                            <Button
                              themeInverse
                              onPress={() => handleAcceptSuggested(item)}
                            >
                              {t("smsImport.sheet.actions.accept")}
                            </Button>
                            <Button onPress={() => openEditor(item)}>
                              {t("common.edit")}
                            </Button>
                            <Button theme="red" onPress={() => markItemRejected(item.id)}>
                              {t("smsImport.sheet.actions.reject")}
                            </Button>
                            <Button onPress={() => dismissItem(item.id)}>
                              {t("smsImport.sheet.actions.dismiss")}
                            </Button>
                          </XStack>
                        </YStack>
                      </Card>
                    </Animated.View>
                  ))}
                </YStack>
              ) : null}

              {resolvedItems.length > 0 && showResolvedItems ? (
                <YStack gap="$3">
                  <XStack justify="space-between" items="center">
                    <Text fontWeight="700">
                      {t("smsImport.sheet.sectionTitles.resolved")}
                    </Text>
                    <Button size="$3" onPress={clearResolvedItems}>
                      {t("smsImport.sheet.footer.clearResolved")}
                    </Button>
                  </XStack>

                  {resolvedItems.map((item) => (
                    <Animated.View
                      key={item.id}
                      layout={LinearTransition.duration(160)}
                      entering={FadeIn.duration(160)}
                    >
                      <Card bordered padding="$3" opacity={0.8}>
                        <YStack gap="$2">
                          <Text fontWeight="700">
                            {item.merchantName || item.sourceMessage.sender}
                          </Text>
                          <Text fontSize="$2" opacity={0.6}>
                            {formatTimestamp(item.sourceMessage.receivedAt)}
                          </Text>
                          <Text>
                            {t("smsImport.sheet.labels.status")}:{" "}
                            {getLocalizedReviewStatus(item.status, t)}
                          </Text>
                          <Text numberOfLines={2} opacity={0.75}>
                            {item.sourceMessage.body}
                          </Text>
                        </YStack>
                      </Card>
                    </Animated.View>
                  ))}
                </YStack>
              ) : null}

              {pendingItems.length === 0 &&
              resolvedItems.length > 0 &&
              !showResolvedItems ? (
                <Card bordered padding="$3" backgroundColor="$backgroundHover">
                  <Text opacity={0.75}>{t("smsImport.sheet.emptyResolved")}</Text>
                </Card>
              ) : null}
            </YStack>
          )}
        </YStack>
      </KeyboardAwareScrollView>

      {editingItem ? null : (
        <YStack
          bg="$background"
          borderTopWidth={1}
          borderColor="$borderColor"
          px="$4"
          pt="$3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <YStack style={layoutStyles.container}>{footer}</YStack>
        </YStack>
      )}
    </YStack>
  )
}
