import type { PaymentMethod } from "../../types/expense"

const upiHintPattern = /\bupi\b/i
const creditCardHintPattern =
  /\bcredit card\b|\bamex\b|american express|クレジットカード/i
const debitCardHintPattern = /\bdebit card\b|デビットカード/i
const cardBrandHintPattern =
  /\bamex\b|american express|\bvisa\b|master\s?card|\bmastercard\b|\brupay\b|\bmaestro\b|\bdiscover\b|\bdiners(?:\s+club)?\b|\bjcb\b/i

export function hasUpiHint(body: string): boolean {
  return upiHintPattern.test(body)
}

export function hasCreditCardHint(body: string): boolean {
  return creditCardHintPattern.test(body)
}

export function hasDebitCardHint(body: string): boolean {
  return debitCardHintPattern.test(body)
}

export function hasCardBrandHint(body: string): boolean {
  return cardBrandHintPattern.test(body)
}

export function inferPaymentMethodFromBody(body: string): PaymentMethod | undefined {
  if (hasUpiHint(body)) {
    return { type: "UPI" }
  }

  if (hasCreditCardHint(body)) {
    return { type: "Credit Card" }
  }

  if (hasDebitCardHint(body)) {
    return { type: "Debit Card" }
  }

  return undefined
}
