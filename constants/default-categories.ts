/**
 * Default category definitions for the expense tracker
 * These match the existing CATEGORIES constant for backward compatibility
 */

import { Category } from "../types/category"

/**
 * Default timestamp for initial categories
 * Using a fixed date ensures consistent initialization
 */
const DEFAULT_TIMESTAMP = "2024-01-01T00:00:00.000Z"

/**
 * The 8 default expense categories
 * Icons and colors match the existing CATEGORIES constant in categories.ts
 */
export const DEFAULT_CATEGORIES: Category[] = [
  {
    label: "Food",
    icon: "Utensils",
    color: "#FFB07C",
    order: 0,
    isDefault: true,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    label: "Transport",
    icon: "Car",
    color: "#87CEEB",
    order: 1,
    isDefault: true,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    label: "Groceries",
    icon: "ShoppingCart",
    color: "#7FDBCA",
    order: 2,
    isDefault: true,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    label: "Rent",
    icon: "Building",
    color: "#A8C686",
    order: 3,
    isDefault: true,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    label: "Utilities",
    icon: "Home",
    color: "#FFE4A0",
    order: 4,
    isDefault: true,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    label: "Entertainment",
    icon: "Film",
    color: "#DDA0DD",
    order: 5,
    isDefault: true,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    label: "Health",
    icon: "Activity",
    color: "#FFB5BA",
    order: 6,
    isDefault: true,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    label: "Other",
    icon: "Circle",
    color: "#C4B7C9",
    order: 7,
    isDefault: true,
    updatedAt: DEFAULT_TIMESTAMP,
  },
]
