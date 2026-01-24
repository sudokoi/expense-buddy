import { z } from "zod"
import { TFunction } from "i18next"
import { PaymentMethodType } from "../types/expense"

// Define payment method values as a tuple for Zod enum
const PAYMENT_METHOD_VALUES: [PaymentMethodType, ...PaymentMethodType[]] = [
  "Cash",
  "Amazon Pay",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other",
]

/**
 * Creates a Zod schema for expense form validation with localized messages.
 * Pass t from useTranslation() to get translated error messages.
 *
 * @param t - Translation function from i18next
 * @returns Zod schema for expense form validation
 */
export function getExpenseFormSchema(t: TFunction) {
  return z.object({
    amount: z
      .string()
      .min(1, t("validation.expense.amountRequired"))
      .refine((val) => !isNaN(parseFloat(val)), {
        message: t("validation.expense.amountInvalid"),
      })
      .refine((val) => parseFloat(val) > 0, {
        message: t("validation.expense.amountPositive"),
      }),
    category: z.string().min(1, t("validation.expense.categoryRequired")),
    note: z.string().optional(),
    paymentMethodType: z.enum(PAYMENT_METHOD_VALUES).optional(),
    paymentMethodId: z.string().optional(),
  })
}

/**
 * Default schema with English messages (for tests and backward compatibility)
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
  category: z.string().min(1, "Category is required"),
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
 * Validate expense form data with localized messages.
 * @param data - Form data to validate
 * @param t - Translation function from i18next
 * @returns Validation result with success/data or errors
 */
export function validateExpenseForm(data: unknown, t?: TFunction): ValidationResult {
  const schema = t ? getExpenseFormSchema(t) : expenseFormSchema
  const result = schema.safeParse(data)

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
