import { PaymentMethod } from "../types/expense"
import { PaymentInstrument } from "../types/payment-instrument"
import { formatPaymentInstrumentLabel } from "../services/payment-instruments"

/**
 * Format payment method for display
 * Returns "Type (identifier)" if identifier exists, otherwise just "Type"
 * Returns undefined if no payment method
 *
 * @param paymentMethod - Optional PaymentMethod object
 * @returns Formatted string or undefined
 */
export function formatPaymentMethodDisplay(
  paymentMethod?: PaymentMethod,
  instruments?: PaymentInstrument[]
): string | undefined {
  if (!paymentMethod) {
    return undefined
  }

  if (paymentMethod.instrumentId && instruments && instruments.length > 0) {
    const inst = instruments.find((i) => i.id === paymentMethod.instrumentId)
    if (inst && !inst.deletedAt) {
      return `${paymentMethod.type} • ${formatPaymentInstrumentLabel(inst)}`
    }
    return `${paymentMethod.type} • Others`
  }

  if (paymentMethod.identifier) {
    return `${paymentMethod.type} (${paymentMethod.identifier})`
  }

  return paymentMethod.type
}
