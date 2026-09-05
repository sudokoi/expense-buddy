import { useTranslation } from "react-i18next"
import type { PaymentMethodType } from "../../types/expense"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { SelectionField } from "./SelectionField"

interface DefaultPaymentMethodSelectorProps {
  value?: PaymentMethodType
  onChange: (type: PaymentMethodType | undefined) => void
}

export function DefaultPaymentMethodSelector({
  value,
  onChange,
}: DefaultPaymentMethodSelectorProps) {
  const { t } = useTranslation()
  return (
    <SelectionField
      label={t("settings.defaultPayment.label")}
      description={t("settings.defaultPayment.description")}
      value={value ?? "none"}
      onChange={(next) =>
        onChange(next === "none" ? undefined : (next as PaymentMethodType))
      }
      options={[
        { value: "none", label: t("settings.defaultPayment.none") },
        ...PAYMENT_METHODS.map((method) => ({
          value: method.value,
          label: t(`paymentMethods.${method.i18nKey}`),
        })),
      ]}
    />
  )
}
