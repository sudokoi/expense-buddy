import { PaymentMethodType } from "../types/expense"
import { Banknote, Smartphone, CreditCard, Building, Circle } from "@tamagui/lucide-icons"
import { ComponentProps, JSX } from "react"

type IconComponent = (propsIn: ComponentProps<typeof Banknote>) => JSX.Element

export interface PaymentMethodConfig {
  label: string
  value: PaymentMethodType
  icon: IconComponent
  hasIdentifier: boolean
  identifierLabel?: string
  maxLength?: number
  i18nKey: string
}

export function getPaymentMethodI18nKey(type: PaymentMethodType): string {
  switch (type) {
    case "Cash":
      return "cash"
    case "Amazon Pay":
      return "amazonPay"
    case "UPI":
      return "upi"
    case "Credit Card":
      return "creditCard"
    case "Debit Card":
      return "debitCard"
    case "Net Banking":
      return "netBanking"
    case "Other":
      return "other"
  }
}

export const PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    label: "Cash",
    value: "Cash",
    i18nKey: "cash",
    icon: Banknote,
    hasIdentifier: false,
  },
  {
    label: "Amazon Pay",
    value: "Amazon Pay",
    i18nKey: "amazonPay",
    icon: Smartphone,
    hasIdentifier: false,
  },
  {
    label: "UPI",
    value: "UPI",
    i18nKey: "upi",
    icon: Smartphone,
    hasIdentifier: true,
    identifierLabel: "Last 3 digits of bank A/C",
    maxLength: 3,
  },
  {
    label: "Credit Card",
    value: "Credit Card",
    i18nKey: "creditCard",
    icon: CreditCard,
    hasIdentifier: true,
    identifierLabel: "Last 4 digits",
    maxLength: 4,
  },
  {
    label: "Debit Card",
    value: "Debit Card",
    i18nKey: "debitCard",
    icon: CreditCard,
    hasIdentifier: true,
    identifierLabel: "Last 4 digits",
    maxLength: 4,
  },
  {
    label: "Net Banking",
    value: "Net Banking",
    i18nKey: "netBanking",
    icon: Building,
    hasIdentifier: false,
  },
  {
    label: "Other",
    value: "Other",
    i18nKey: "other",
    icon: Circle,
    hasIdentifier: true,
    identifierLabel: "Description",
    maxLength: 50,
  },
]
