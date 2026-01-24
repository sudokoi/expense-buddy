import { PaymentMethodType } from "../types/expense"
import { PaymentInstrument, PaymentInstrumentMethod } from "../types/payment-instrument"
import i18next from "i18next"

export const PAYMENT_INSTRUMENT_METHODS: PaymentInstrumentMethod[] = [
  "Credit Card",
  "Debit Card",
  "UPI",
]

export function isPaymentInstrumentMethod(
  method: PaymentMethodType
): method is PaymentInstrumentMethod {
  return (PAYMENT_INSTRUMENT_METHODS as readonly string[]).includes(method)
}

export function getLastDigitsLength(method: PaymentInstrumentMethod): number {
  switch (method) {
    case "UPI":
      return 3
    case "Credit Card":
    case "Debit Card":
      return 4
  }
}

export function normalizeNickname(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase()
}

export function sanitizeLastDigits(input: string, maxLength: number): string {
  return input.replace(/\D/g, "").slice(0, maxLength)
}

export function formatMaskedLastDigits(
  method: PaymentInstrumentMethod,
  lastDigits: string
): string {
  if (method === "UPI") {
    return lastDigits
  }
  return `****${lastDigits}`
}

export function formatPaymentInstrumentLabel(inst: PaymentInstrument): string {
  return `${inst.nickname} • ${formatMaskedLastDigits(inst.method, inst.lastDigits)}`
}

export function isInstrumentDeleted(inst: PaymentInstrument): boolean {
  return !!inst.deletedAt
}

export function getActivePaymentInstruments(
  instruments: PaymentInstrument[]
): PaymentInstrument[] {
  return instruments.filter((i) => !i.deletedAt)
}

export function findInstrumentById(
  instruments: PaymentInstrument[],
  id: string | undefined
): PaymentInstrument | undefined {
  if (!id) return undefined
  return instruments.find((i) => i.id === id)
}

export function findActiveInstrumentByMethodAndLastDigits(
  instruments: PaymentInstrument[],
  method: PaymentInstrumentMethod,
  lastDigits: string
): PaymentInstrument | undefined {
  return instruments.find(
    (i) => !i.deletedAt && i.method === method && i.lastDigits === lastDigits
  )
}

export function generatePaymentInstrumentId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export type PaymentInstrumentValidationResult =
  | { success: true }
  | { success: false; errors: Record<string, string> }

// ...

export function validatePaymentInstrumentInput(
  input: { method: PaymentInstrumentMethod; nickname: string; lastDigits: string },
  existing: PaymentInstrument[],
  editingId?: string
): PaymentInstrumentValidationResult {
  const errors: Record<string, string> = {}

  const nickname = input.nickname.trim()
  if (!nickname) {
    errors.nickname =
      i18next.t("settings.instruments.form.nicknameRequired") ?? "Nickname is required"
  } else if (nickname.length > 30) {
    errors.nickname =
      i18next.t("settings.instruments.form.nicknameTooLong") ??
      "Nickname must be 30 characters or less"
  }

  const expectedLen = getLastDigitsLength(input.method)
  if (input.lastDigits.length !== expectedLen) {
    errors.lastDigits =
      i18next.t("settings.instruments.form.digitsError", { count: expectedLen }) ??
      `Enter exactly ${expectedLen} digits`
  }

  const normalized = normalizeNickname(nickname)
  const nicknameTaken = existing.some((inst) => {
    if (inst.deletedAt) return false
    if (inst.method !== input.method) return false
    if (editingId && inst.id === editingId) return false
    return normalizeNickname(inst.nickname) === normalized
  })

  if (nicknameTaken) {
    errors.nickname =
      i18next.t("settings.instruments.form.nicknameTaken") ??
      "Nickname already exists for this payment method"
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }

  return { success: true }
}

export function createMigrationNickname(
  method: PaymentInstrumentMethod,
  lastDigits: string,
  existing: PaymentInstrument[]
): string {
  const base =
    method === "UPI"
      ? `UPI ${lastDigits}`
      : method === "Credit Card"
        ? `Credit ${lastDigits}`
        : `Debit ${lastDigits}`

  const normalizedBase = normalizeNickname(base)
  const used = new Set(
    existing
      .filter((i) => !i.deletedAt && i.method === method)
      .map((i) => normalizeNickname(i.nickname))
  )

  if (!used.has(normalizedBase)) {
    return base
  }

  let counter = 2
  while (true) {
    const candidate = `${base} (${counter})`
    if (!used.has(normalizeNickname(candidate))) {
      return candidate
    }
    counter += 1
  }
}
