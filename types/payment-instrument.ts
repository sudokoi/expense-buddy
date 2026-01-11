import { PaymentMethodType } from "./expense"

export type PaymentInstrumentMethod = Extract<
  PaymentMethodType,
  "Credit Card" | "Debit Card" | "UPI"
>

export interface PaymentInstrument {
  id: string
  method: PaymentInstrumentMethod
  nickname: string
  lastDigits: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}
