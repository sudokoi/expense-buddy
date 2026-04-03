import {
  formatAmount,
  hasOperators,
  parseExpression,
  type ParseResult,
} from "./expression-parser"

export interface AmountInputOptions {
  allowMathExpressions?: boolean
  allowZero?: boolean
}

const NUMERIC_AMOUNT_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)$/

function getMinimumError(allowZero: boolean): string {
  return allowZero ? "Amount must be zero or greater" : "Amount must be greater than zero"
}

export function parseNumericAmount(
  input: string,
  { allowZero = false }: Pick<AmountInputOptions, "allowZero"> = {}
): ParseResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { success: false, error: "Please enter a valid amount" }
  }

  if (!NUMERIC_AMOUNT_PATTERN.test(trimmed)) {
    return { success: false, error: "Please enter a valid amount" }
  }

  const value = Number(trimmed)
  if (!isFinite(value) || isNaN(value)) {
    return { success: false, error: "Please enter a valid amount" }
  }

  if (allowZero ? value < 0 : value <= 0) {
    return { success: false, error: getMinimumError(allowZero) }
  }

  return { success: true, value }
}

export function parseAmountInput(
  input: string,
  { allowMathExpressions = true, allowZero = false }: AmountInputOptions = {}
): ParseResult {
  if (allowMathExpressions) {
    return parseExpression(input, { allowZero })
  }

  return parseNumericAmount(input, { allowZero })
}

export function getAmountPreview(
  input: string,
  { allowMathExpressions = true, allowZero = false }: AmountInputOptions = {}
): string | null {
  if (!allowMathExpressions || !input.trim() || !hasOperators(input)) {
    return null
  }

  const result = parseExpression(input, { allowZero })
  if (result.success && result.value !== undefined) {
    return formatAmount(result.value)
  }

  return null
}

export function getAmountInputProps(allowMathExpressions: boolean) {
  return allowMathExpressions
    ? {
        keyboardType: "default" as const,
        inputMode: "text" as const,
      }
    : {
        keyboardType: "decimal-pad" as const,
        inputMode: "decimal" as const,
      }
}
