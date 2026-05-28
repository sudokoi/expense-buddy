import { useCallback, useMemo } from "react"
import { useSelector } from "@xstate/store-react"
import { useStoreContext } from "../store-provider"
import { selectCategoryByLabel } from "../settings-store"
import { Category } from "../../types/category"

export const useCategories = () => {
  const { settingsStore, expenseStore } = useStoreContext()

  const rawCategories = useSelector(
    settingsStore,
    (state) => state.context.settings.categories
  )

  const categories = useMemo(
    () =>
      [...rawCategories].sort((a, b) => {
        if (a.label === "Other") return 1
        if (b.label === "Other") return -1
        return a.order - b.order
      }),
    [rawCategories]
  )

  const getCategoryByLabel = useCallback(
    (label: string): Category | undefined => {
      const state = settingsStore.getSnapshot()
      return selectCategoryByLabel(state.context, label)
    },
    [settingsStore]
  )

  const addCategory = useCallback(
    (category: Omit<Category, "order" | "updatedAt">) => {
      settingsStore.trigger.addCategory({ category })
    },
    [settingsStore]
  )

  const updateCategory = useCallback(
    (label: string, updates: Partial<Omit<Category, "updatedAt">>) => {
      const nextLabel = updates.label?.trim()
      if (nextLabel && nextLabel !== label) {
        expenseStore.trigger.updateExpenseCategories({
          fromCategory: label,
          toCategory: nextLabel,
        })
      }
      settingsStore.trigger.updateCategory({ label, updates })
    },
    [settingsStore, expenseStore]
  )

  const deleteCategory = useCallback(
    (label: string) => {
      settingsStore.trigger.deleteCategory({ label })
    },
    [settingsStore]
  )

  const reorderCategories = useCallback(
    (labels: string[]) => {
      settingsStore.trigger.reorderCategories({ labels })
    },
    [settingsStore]
  )

  const replaceCategories = useCallback(
    (newCategories: Category[]) => {
      settingsStore.trigger.replaceCategories({ categories: newCategories })
    },
    [settingsStore]
  )

  return {
    categories,
    getCategoryByLabel,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    replaceCategories,
  }
}
