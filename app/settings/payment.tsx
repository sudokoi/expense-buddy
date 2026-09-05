import { useCallback, useMemo, useState } from "react"
import { Stack } from "expo-router"
import { Text, View } from "react-native"
import { useAppDialog } from "../../providers/app-dialog-provider"
import { useTranslation } from "react-i18next"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Card } from "../../components/ui/Card"
import { DefaultPaymentMethodSelector } from "../../components/ui/DefaultPaymentMethodSelector"
import { PaymentInstrumentsSection } from "../../components/ui/settings/PaymentInstrumentsSection"
import { CategorySection } from "../../components/ui/CategorySection"
import { CategoryFormModal } from "../../components/ui/CategoryFormModal"
import {
  useCategories,
  useExpenses,
  useNotifications,
  useSettings,
} from "../../stores/hooks"
import type { Category } from "../../types/category"
import { UI_SPACE } from "../../constants/ui-tokens"

export default function PaymentSettingsScreen() {
  const { showDialog } = useAppDialog()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
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

      showDialog(t("settings.categories.deleteDialog.title"), message, [
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
      showDialog,
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
      <Stack.Screen options={{ title: t("settings.payment.title") }} />

      <KeyboardAwareScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{
          padding: UI_SPACE.gutter,
          paddingTop: UI_SPACE.control,
          paddingBottom: Math.max(insets.bottom, UI_SPACE.gutter),
        }}
        bottomOffset={50}
        keyboardShouldPersistTaps="handled"
      >
        <View className="max-w-[600px] w-full self-center gap-4">
          <View className="gap-2">
            <DefaultPaymentMethodSelector
              value={settings.defaultPaymentMethod}
              onChange={setDefaultPaymentMethod}
            />
            <Text className="text-sm text-muted-foreground">
              {t("settings.defaultPayment.description")}
            </Text>
          </View>

          <Card className="p-3">
            <PaymentInstrumentsSection />
          </Card>

          <Card className="p-3">
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
          </Card>
        </View>
      </KeyboardAwareScrollView>

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
