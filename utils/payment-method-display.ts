import { PaymentMethod } from "../types/expense"
import { PaymentInstrument } from "../types/payment-instrument"
import { formatPaymentInstrumentLabel } from "../services/payment-instruments"
import i18next from "i18next"
import { getPaymentMethodI18nKey } from "../constants/payment-methods"

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

  const methodLabel = i18next.t(
    `paymentMethods.${getPaymentMethodI18nKey(paymentMethod.type)}`
  )

  if (paymentMethod.instrumentId && instruments && instruments.length > 0) {
    const inst = instruments.find((i) => i.id === paymentMethod.instrumentId)
    if (inst && !inst.deletedAt) {
      return `${methodLabel} • ${formatPaymentInstrumentLabel(inst)}`
    }
    const othersLabel = i18next.t("instruments.dropdown.others").split(" / ")[0]
    return `${methodLabel} • ${othersLabel}`
  }

  if (paymentMethod.identifier) {
    return `${methodLabel} (${paymentMethod.identifier})`
  }

  return methodLabel
}
