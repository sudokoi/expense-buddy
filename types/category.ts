/**
 * Category type definitions for custom expense categories
 */

/**
 * Represents a user-defined expense category
 */
export interface Category {
  /** Unique identifier and display name (1-30 characters) */
  label: string
  /** Lucide icon name (e.g., "Utensils", "Car") */
  icon: string
  /** Hex color code (e.g., "#FFB07C") */
  color: string
  /** Display order (0-based index) */
  order: number
  /** Whether this is a default category */
  isDefault: boolean
  /** ISO timestamp for sync conflict resolution */
  updatedAt: string
}

/**
 * Configuration for category storage
 */
export interface CategoryConfig {
  /** Array of user-defined categories */
  categories: Category[]
  /** Schema version for future migrations */
  version: number
}
