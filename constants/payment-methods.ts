import { PaymentMethodType } from "../types/expense"
import {
    Banknote,
    Smartphone,
    CreditCard,
    Building,
    Circle,
} from "@tamagui/lucide-icons"
import { ComponentProps, JSX } from "react"

type IconComponent = (propsIn: ComponentProps<typeof Banknote>) => JSX.Element

export interface PaymentMethodConfig {
    label: string
    value: PaymentMethodType
    icon: IconComponent
    hasIdentifier: boolean
    identifierLabel?: string
    maxLength?: number
}

export const PAYMENT_METHODS: PaymentMethodConfig[] = [
    {
        label: "Cash",
        value: "Cash",
        icon: Banknote,
        hasIdentifier: false,
    },
    {
        label: "UPI",
        value: "UPI",
        icon: Smartphone,
        hasIdentifier: true,
        identifierLabel: "Last 3 digits of bank A/C",
        maxLength: 3,
    },
    {
        label: "Credit Card",
        value: "Credit Card",
        icon: CreditCard,
        hasIdentifier: true,
        identifierLabel: "Last 4 digits",
        maxLength: 4,
    },
    {
        label: "Debit Card",
        value: "Debit Card",
        icon: CreditCard,
        hasIdentifier: true,
        identifierLabel: "Last 4 digits",
        maxLength: 4,
    },
    {
        label: "Net Banking",
        value: "Net Banking",
        icon: Building,
        hasIdentifier: false,
    },
    {
        label: "Other",
        value: "Other",
        icon: Circle,
        hasIdentifier: false,
    },
]
