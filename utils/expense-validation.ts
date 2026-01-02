import { z } from "zod"
import { ExpenseCategory, PaymentMethodType } from "../types/expense"

// Define category values as a tuple for Zod enum
const CATEGORY_VALUES: [ExpenseCategory, ...ExpenseCategory[]] = [
  "Food",
  "Groceries",
  "Transport",
  "Utilities",
  "Entertainment",
  "Health",
  "Other",
]

// Define payment method values as a tuple for Zod enum
const PAYMENT_METHOD_VALUES: [PaymentMethodType, ...PaymentMethodType[]] = [
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other",
]

/**
 * Zod schema for expense form validation
 * Used by both add and edit flows for consistent validation
 */
export const expenseFormSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(parseFloat(val)), {
      message: "Amount must be a valid number",
    })
    .refine((val) => parseFloat(val) > 0, {
      message: "Amount must be positive",
    }),
  category: z.enum(CATEGORY_VALUES),
  note: z.string().optional(),
  paymentMethodType: z.enum(PAYMENT_METHOD_VALUES).optional(),
  paymentMethodId: z.string().optional(),
})

export type ExpenseFormData = z.infer<typeof expenseFormSchema>

/**
 * Validation result type
 */
export type ValidationResult =
  | { success: true; data: ExpenseFormData }
  | { success: false; errors: Record<string, string> }

/**
 * Validate expense form data (used by both add and edit flows)
 * Returns { success: true, data } or { success: false, errors }
 */
export function validateExpenseForm(data: unknown): ValidationResult {
  const result = expenseFormSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join(".")
    // Only keep the first error for each field
    if (!errors[path]) {
      errors[path] = issue.message
    }
  }

  return { success: false, errors }
}
