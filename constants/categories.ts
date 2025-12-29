import { ExpenseCategory } from "../types/expense"
import {
  Utensils,
  Car,
  Home,
  Film,
  Activity,
  Circle,
  ShoppingCart,
} from "@tamagui/lucide-icons"
import { ComponentProps, JSX } from "react"
import { CATEGORY_COLORS } from "./category-colors"

type IconComponent = (propsIn: ComponentProps<typeof Utensils>) => JSX.Element

export const CATEGORIES: {
  label: string
  value: ExpenseCategory
  icon: IconComponent
  color: string
}[] = [
  { label: "Food", value: "Food", icon: Utensils, color: CATEGORY_COLORS.Food },
  {
    label: "Groceries",
    value: "Groceries",
    icon: ShoppingCart,
    color: CATEGORY_COLORS.Groceries,
  },
  { label: "Transport", value: "Transport", icon: Car, color: CATEGORY_COLORS.Transport },
  {
    label: "Utilities",
    value: "Utilities",
    icon: Home,
    color: CATEGORY_COLORS.Utilities,
  },
  {
    label: "Entertainment",
    value: "Entertainment",
    icon: Film,
    color: CATEGORY_COLORS.Entertainment,
  },
  { label: "Health", value: "Health", icon: Activity, color: CATEGORY_COLORS.Health },
  { label: "Other", value: "Other", icon: Circle, color: CATEGORY_COLORS.Other },
]
