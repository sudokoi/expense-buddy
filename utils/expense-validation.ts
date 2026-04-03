import { z } from "zod"
import { TFunction } from "i18next"
import { PaymentMethodType } from "../types/expense"
import { parseAmountInput } from "./amount-input"

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
function getValidationMessages(t?: TFunction) {
  return {
    amountRequired: t ? t("validation.expense.amountRequired") : "Amount is required",
    amountInvalid: t
      ? t("validation.expense.amountInvalid")
      : "Amount must be a valid number",
    amountPositive: t
      ? t("validation.expense.amountPositive")
      : "Amount must be positive",
    categoryRequired: t
      ? t("validation.expense.categoryRequired")
      : "Category is required",
  }
}

function getExpenseFormSchemaBase(categoryRequiredMessage: string) {
  return z.object({
    amount: z.string(),
    category: z.string().min(1, categoryRequiredMessage),
    note: z.string().optional(),
    paymentMethodType: z.enum(PAYMENT_METHOD_VALUES).optional(),
    paymentMethodId: z.string().optional(),
  })
}

export function getExpenseFormSchema(t: TFunction) {
  const messages = getValidationMessages(t)

  return getExpenseFormSchemaBase(messages.categoryRequired).superRefine(
    (data, context) => {
      const amountResult = parseAmountInput(data.amount, { allowMathExpressions: true })

      if (!data.amount.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: messages.amountRequired,
        })
        return
      }

      if (!amountResult.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message:
            amountResult.error === "Amount must be greater than zero"
              ? messages.amountPositive
              : messages.amountInvalid,
        })
      }
    }
  )
}

/**
 * Default schema with English messages (for tests and backward compatibility)
 */
export const expenseFormSchema = getExpenseFormSchemaBase("Category is required")

export type ExpenseFormData = z.infer<typeof expenseFormSchema>

export interface ExpenseValidationOptions {
  allowMathExpressions?: boolean
}

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
export function validateExpenseForm(
  data: unknown,
  t?: TFunction,
  { allowMathExpressions = true }: ExpenseValidationOptions = {}
): ValidationResult {
  const messages = getValidationMessages(t)
  const schema = getExpenseFormSchemaBase(messages.categoryRequired)
  const result = schema.safeParse(data)

  const amount =
    typeof (data as { amount?: unknown })?.amount === "string"
      ? (data as { amount: string }).amount
      : ""

  const amountResult = parseAmountInput(amount, { allowMathExpressions })

  if (result.success && amountResult.success) {
    return { success: true, data: result.data }
  }

  const errors: Record<string, string> = {}

  if (!amount.trim()) {
    errors.amount = messages.amountRequired
  } else if (!amountResult.success) {
    errors.amount =
      amountResult.error === "Amount must be greater than zero"
        ? messages.amountPositive
        : messages.amountInvalid
  }

  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.join(".")
      // Only keep the first error for each field
      if (!errors[path]) {
        errors[path] = issue.message
      }
    }
  }

  return { success: false, errors }
}
