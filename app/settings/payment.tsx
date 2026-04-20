import { useCallback, useMemo, useState } from "react"
import { Stack } from "expo-router"
import { Alert, ViewStyle } from "react-native"
import { Label, Text, XStack, YStack } from "tamagui"
import { useTranslation } from "react-i18next"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { SettingsSection } from "../../components/ui/SettingsSection"
import { DefaultPaymentMethodSelector } from "../../components/ui/DefaultPaymentMethodSelector"
import { PaymentInstrumentsSection } from "../../components/ui/settings/PaymentInstrumentsSection"
import { CategorySection } from "../../components/ui/CategorySection"
import { CategoryFormModal } from "../../components/ui/CategoryFormModal"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import {
  useCategories,
  useExpenses,
  useNotifications,
  useSettings,
} from "../../stores/hooks"
import type { Category } from "../../types/category"
import type { PaymentMethodType } from "../../types/expense"

const layoutStyles = {
  container: {
    maxWidth: 720,
    alignSelf: "center",
    width: "100%",
  } as ViewStyle,
  summaryRow: {
    flexWrap: "wrap",
  } as ViewStyle,
  summaryCard: {
    minWidth: 160,
    borderRadius: 16,
  } as ViewStyle,
} as const

export default function PaymentSettingsScreen() {
  const { t } = useTranslation()
  const { settings, setDefaultPaymentMethod } = useSettings()
  const { state, reassignExpensesToOther } = useExpenses()
  const { addNotification } = useNotifications()
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories } =
    useCategories()

  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined)

  const existingCategoryLabels = useMemo(
    () => categories.map((category) => category.label),
    [categories]
  )
  const defaultPaymentMethodLabel = useMemo(() => {
    const value = settings.defaultPaymentMethod
    if (!value) return t("settings.defaultPayment.none")
    const match = PAYMENT_METHODS.find((method) => method.value === value)
    return match?.label ?? value
  }, [settings.defaultPaymentMethod, t])
  const activePaymentInstrumentCount = useMemo(
    () =>
      (settings.paymentInstruments ?? []).filter((instrument) => !instrument.deletedAt)
        .length,
    [settings.paymentInstruments]
  )

  const getExpenseCountForCategory = useCallback(
    (label: string): number => {
      return state.expenses.filter(
        (expense) => expense.category === label && !expense.deletedAt
      ).length
    },
    [state.expenses]
  )

  const handleCategoryDelete = useCallback(
    (label: string) => {
      if (label === "Other") {
        addNotification(t("settings.notifications.otherDeleteError"), "error")
        return
      }

      const expenseCount = getExpenseCountForCategory(label)
      const message =
        expenseCount > 0
          ? t("settings.categories.deleteDialog.messageReassign", {
              label,
              count: expenseCount,
            })
          : t("settings.categories.deleteDialog.messageSimple", { label })

      Alert.alert(t("settings.categories.deleteDialog.title"), message, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            if (expenseCount > 0) {
              reassignExpensesToOther(label)
            }
            deleteCategory(label)
            addNotification(
              t("settings.notifications.categoryDeleted", { label }),
              "success"
            )
          },
        },
      ])
    },
    [
      addNotification,
      deleteCategory,
      getExpenseCountForCategory,
      reassignExpensesToOther,
      t,
    ]
  )

  const handleCategorySave = useCallback(
    (categoryData: Omit<Category, "order" | "updatedAt">) => {
      if (editingCategory) {
        updateCategory(editingCategory.label, {
          label: categoryData.label,
          icon: categoryData.icon,
          color: categoryData.color,
          isDefault: categoryData.isDefault,
        })
        addNotification(
          t("settings.notifications.categoryUpdated", { label: categoryData.label }),
          "success"
        )
      } else {
        addCategory(categoryData)
        addNotification(
          t("settings.notifications.categoryAdded", { label: categoryData.label }),
          "success"
        )
      }

      setCategoryFormOpen(false)
      setEditingCategory(undefined)
    },
    [addCategory, addNotification, editingCategory, t, updateCategory]
  )

  return (
    <>
      <Stack.Screen options={{ title: t("settings.payment.manageTitle") }} />

      <ScreenContainer contentContainerStyle={{ paddingTop: 8 }}>
        <YStack gap="$4" style={layoutStyles.container}>
          <SettingsSection
            title={t("settings.sections.payment")}
            description={t("settings.payment.manageHelp")}
            gap="$4"
          >
            <XStack gap="$3" style={layoutStyles.summaryRow}>
              <YStack
                flex={1}
                bg="$backgroundHover"
                p="$3"
                gap="$1"
                style={layoutStyles.summaryCard}
              >
                <Text color="$color" opacity={0.58} fontSize="$2" fontWeight="700">
                  {t("settings.defaultPayment.label")}
                </Text>
                <Text color="$color" fontSize="$5" fontWeight="700" numberOfLines={2}>
                  {defaultPaymentMethodLabel}
                </Text>
              </YStack>

              <YStack
                flex={1}
                bg="$backgroundHover"
                p="$3"
                gap="$1"
                style={layoutStyles.summaryCard}
              >
                <Text color="$color" opacity={0.58} fontSize="$2" fontWeight="700">
                  {t("settings.payment.instrumentsTitle")}
                </Text>
                <Text color="$color" fontSize="$5" fontWeight="700">
                  {activePaymentInstrumentCount}
                </Text>
              </YStack>

              <YStack
                flex={1}
                bg="$backgroundHover"
                p="$3"
                gap="$1"
                style={layoutStyles.summaryCard}
              >
                <Text color="$color" opacity={0.58} fontSize="$2" fontWeight="700">
                  {t("settings.payment.categoriesTitle")}
                </Text>
                <Text color="$color" fontSize="$5" fontWeight="700">
                  {categories.length}
                </Text>
              </YStack>
            </XStack>
          </SettingsSection>

          <SettingsSection
            title={t("settings.sections.defaultPayment")}
            description={t("settings.defaultPayment.description")}
          >
            <YStack gap="$2">
              <Label>{t("settings.sections.defaultPayment")}</Label>
              <YStack bg="$backgroundHover" p="$3" style={{ borderRadius: 16 }}>
                <DefaultPaymentMethodSelector
                  value={settings.defaultPaymentMethod}
                  onChange={(paymentMethod) =>
                    setDefaultPaymentMethod(
                      paymentMethod as PaymentMethodType | undefined
                    )
                  }
                />
              </YStack>
              <Text color="$color" opacity={0.58} fontSize="$2">
                {t("settings.payment.defaultMethodHelp")}
              </Text>
            </YStack>
          </SettingsSection>

          <SettingsSection
            title={t("settings.payment.instrumentsTitle")}
            description={t("instruments.description")}
          >
            <PaymentInstrumentsSection />
          </SettingsSection>

          <SettingsSection
            title={t("settings.payment.categoriesTitle")}
            description={t("settings.categories.description")}
          >
            <CategorySection
              categories={categories}
              onAdd={() => {
                setEditingCategory(undefined)
                setCategoryFormOpen(true)
              }}
              onEdit={(category) => {
                setEditingCategory(category)
                setCategoryFormOpen(true)
              }}
              onDelete={handleCategoryDelete}
              onReorder={reorderCategories}
              getExpenseCount={getExpenseCountForCategory}
            />
          </SettingsSection>
        </YStack>
      </ScreenContainer>

      <CategoryFormModal
        open={categoryFormOpen}
        onClose={() => {
          setCategoryFormOpen(false)
          setEditingCategory(undefined)
        }}
        category={editingCategory}
        existingLabels={existingCategoryLabels}
        onSave={handleCategorySave}
      />
    </>
  )
}
