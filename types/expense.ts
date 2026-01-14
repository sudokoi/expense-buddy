export type ExpenseCategory = string

export type PaymentMethodType =
  | "Cash"
  | "Amazon Pay"
  | "UPI"
  | "Credit Card"
  | "Debit Card"
  | "Net Banking"
  | "Other"

export interface PaymentMethod {
  type: PaymentMethodType
  identifier?: string // Last 4 digits for cards, last 3 for UPI bank account
  instrumentId?: string // Optional link to a saved payment instrument (nickname + lastDigits)
}

export interface Expense {
  id: string
  amount: number
  category: ExpenseCategory
  date: string // ISO string
  note: string
  paymentMethod?: PaymentMethod // Optional payment method
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  deletedAt?: string // ISO timestamp - when soft-deleted (undefined if not deleted)
}
