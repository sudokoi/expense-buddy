import { z } from "zod"
import { ALL_CATEGORY_ICONS } from "../constants/category-icons"
import { CATEGORY_COLOR_PALETTE } from "../constants/category-colors"

/**
 * Zod schema for category label validation
 * Validates length (1-30 chars), non-whitespace, and alphanumeric content
 */
export const categoryLabelSchema = z
  .string()
  .min(1, "Category name is required")
  .max(30, "Category name must be 30 characters or less")
  .refine((val) => val.trim().length > 0, {
    message: "Category name cannot be only whitespace",
  })
  .refine((val) => /[a-zA-Z0-9]/.test(val), {
    message: "Category name must contain at least one letter or number",
  })

/**
 * Zod schema for full category validation
 * Validates label, icon (from curated list), and color (hex format)
 */
export const categorySchema = z.object({
  label: categoryLabelSchema,
  icon: z.string().min(1, "Icon is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code"),
})

export type CategoryFormData = z.infer<typeof categorySchema>

/**
 * Validation result type for category form
 */
export type CategoryValidationResult =
  | { success: true; data: CategoryFormData }
  | { success: false; errors: Record<string, string> }

/**
 * Validate category form data with uniqueness check
 * @param data - The form data to validate (label, icon, color)
 * @param existingLabels - Array of existing category labels for uniqueness check
 * @param currentLabel - Optional current label (for edit mode - excludes self from uniqueness check)
 * @returns Validation result with success/data or errors
 */
export function validateCategoryForm(
  data: { label: string; icon: string; color: string },
  existingLabels: string[],
  currentLabel?: string
): CategoryValidationResult {
  // First validate the schema
  const result = categorySchema.safeParse(data)

  const errors: Record<string, string> = {}

  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.join(".")
      // Only keep the first error for each field
      if (!errors[path]) {
        errors[path] = issue.message
      }
    }
  }

  // Check for duplicate label (case-insensitive)
  const normalizedLabel = data.label.trim().toLowerCase()
  const isDuplicate = existingLabels.some((existing) => {
    const normalizedExisting = existing.toLowerCase()
    // In edit mode, exclude the current label from duplicate check
    if (currentLabel && normalizedExisting === currentLabel.toLowerCase()) {
      return false
    }
    return normalizedExisting === normalizedLabel
  })

  if (isDuplicate && !errors["label"]) {
    errors["label"] = "A category with this name already exists"
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }

  return { success: true, data: result.data! }
}

/**
 * Check if a label is valid (without uniqueness check)
 * Useful for real-time validation feedback
 */
export function isValidCategoryLabel(label: string): boolean {
  return categoryLabelSchema.safeParse(label).success
}

/**
 * Check if an icon is from the curated list
 */
export function isValidCategoryIcon(icon: string): boolean {
  return ALL_CATEGORY_ICONS.includes(icon)
}

/**
 * Check if a color is from the palette (or valid hex)
 */
export function isValidCategoryColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

/**
 * Check if a color is from the predefined palette
 */
export function isColorFromPalette(color: string): boolean {
  return CATEGORY_COLOR_PALETTE.includes(color)
}
