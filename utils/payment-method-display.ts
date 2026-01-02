import { PaymentMethod } from "../types/expense"

/**
 * Format payment method for display
 * Returns "Type (identifier)" if identifier exists, otherwise just "Type"
 * Returns undefined if no payment method
 *
 * @param paymentMethod - Optional PaymentMethod object
 * @returns Formatted string or undefined
 */
export function formatPaymentMethodDisplay(
  paymentMethod?: PaymentMethod
): string | undefined {
  if (!paymentMethod) {
    return undefined
  }

  if (paymentMethod.identifier) {
    return `${paymentMethod.type} (${paymentMethod.identifier})`
  }

  return paymentMethod.type
}
