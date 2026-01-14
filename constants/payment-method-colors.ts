import { PaymentMethodType } from "../types/expense"

/**
 * Payment method colors for analytics charts
 * Consistent colors matching the payment method theme
 */
export const PAYMENT_METHOD_COLORS: Record<PaymentMethodType | "Other", string> = {
  Cash: "#22c55e", // Green
  "Amazon Pay": "#ff9900", // Amazon orange
  UPI: "#8b5cf6", // Purple
  "Credit Card": "#f59e0b", // Amber
  "Debit Card": "#3b82f6", // Blue
  "Net Banking": "#06b6d4", // Cyan
  Other: "#6b7280", // Gray - for expenses without payment method
}

/**
 * Get the color for a payment method type, with fallback to "Other"
 */
export function getPaymentMethodColor(
  paymentMethodType: PaymentMethodType | "Other" | undefined
): string {
  if (!paymentMethodType) {
    return PAYMENT_METHOD_COLORS.Other
  }
  return PAYMENT_METHOD_COLORS[paymentMethodType] ?? PAYMENT_METHOD_COLORS.Other
}
