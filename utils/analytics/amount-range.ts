import { parseAmountInput } from "../amount-input"

export function parseAmountRange(
  min: string,
  max: string,
  allowMathExpressions: boolean
) {
  const options = { allowZero: true, allowMathExpressions }
  const lower = min.trim() ? parseAmountInput(min, options) : null
  const upper = max.trim() ? parseAmountInput(max, options) : null
  const minAmount = lower?.success ? (lower.value ?? null) : null
  const maxAmount = upper?.success ? (upper.value ?? null) : null
  const error =
    (lower && !lower.success) || (upper && !upper.success)
      ? "invalidAmount"
      : minAmount !== null && maxAmount !== null && minAmount > maxAmount
        ? "invalidRange"
        : null
  return { minAmount, maxAmount, error }
}
