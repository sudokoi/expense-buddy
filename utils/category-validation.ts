import { z } from "zod"
import { TFunction } from "i18next"
import { ALL_CATEGORY_ICONS } from "../constants/category-icons"
import { CATEGORY_COLOR_PALETTE } from "../constants/category-colors"

/**
 * Creates a Zod schema for category label validation with localized messages.
 * Validates length (1-30 chars), non-whitespace, and alphanumeric content.
 *
 * @param t - Translation function from i18next
 * @returns Zod schema for category label validation
 */
export function getCategoryLabelSchema(t: TFunction) {
  return z
    .string()
    .min(1, t("validation.category.nameRequired"))
    .max(30, t("validation.category.nameMaxLength"))
    .refine((val) => val.trim().length > 0, {
      message: t("validation.category.nameWhitespace"),
    })
    .refine((val) => /[a-zA-Z0-9]/.test(val), {
      message: t("validation.category.nameAlphanumeric"),
    })
}

/**
 * Creates a Zod schema for full category validation with localized messages.
 * Validates label, icon (from curated list), and color (hex format).
 *
 * @param t - Translation function from i18next
 * @returns Zod schema for category validation
 */
export function getCategorySchema(t: TFunction) {
  return z.object({
    label: getCategoryLabelSchema(t),
    icon: z.string().min(1, t("validation.category.iconRequired")),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, t("validation.category.colorInvalid")),
  })
}

/**
 * Default schema with English messages (for tests and backward compatibility)
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
 * Default schema with English messages (for tests and backward compatibility)
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
 * Validate category form data with uniqueness check and optional localization.
 * @param data - The form data to validate (label, icon, color)
 * @param existingLabels - Array of existing category labels for uniqueness check
 * @param currentLabel - Optional current label (for edit mode - excludes self from uniqueness check)
 * @param t - Optional translation function for localized messages
 * @returns Validation result with success/data or errors
 */
export function validateCategoryForm(
  data: { label: string; icon: string; color: string },
  existingLabels: string[],
  currentLabel?: string,
  t?: TFunction
): CategoryValidationResult {
  // Use localized schema if t is provided
  const schema = t ? getCategorySchema(t) : categorySchema
  const result = schema.safeParse(data)

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
    errors["label"] = t
      ? t("validation.category.nameDuplicate")
      : "A category with this name already exists"
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
