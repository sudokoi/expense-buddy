import { PaymentMethod } from "../../types/expense"
import { SmsImportRawMessage } from "../../types/sms-import"
import { DEFAULT_CATEGORIES } from "../../constants/default-categories"
import { inferPaymentMethodFromBody } from "./payment-method-hints"

export interface ParsedSmsImportCandidate {
  amount: number
  currency: string
  merchantName?: string
  categorySuggestion?: string
  paymentMethodSuggestion?: PaymentMethod
  noteSuggestion?: string
  transactionDate: string
  matchedLocale: string
  matchedPatternKey: string
}

const amountPattern = /(?:INR|RS\.?|₹)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i
const debitKeywords = /debited|spent|withdrawn|paid|purchase|txn|transaction|upi/i
const settledDebitKeywords = /debited|spent|withdrawn|paid|purchase/i
const creditOnlyKeywords = /credited|received/i
const otpKeywords =
  /\botp\b|one[ -]?time password|verification code|security code|auth(?:entication)? code|passcode|do not share|never share|valid for \d+ (?:minute|min|minutes|mins)/i
const nonExpenseInfoKeywords =
  /available balance|avl(?:\.|\s)?bal|a\/c balance|account balance|balance is|ledger balance|min(?:imum)? due|total due|payment due|due date|bill(?:ing)? statement|statement generated|statement ready|e-?statement|autopay|auto-debit mandate|standing instruction|card ending|card blocked|card hotlisted|card limit|credit limit|cash limit|cvv|pin|mpin|tpin|token(?:isation|ization)?|token generated|registered for e-?com|e-?commerce|online usage enabled|international usage enabled|contactless usage enabled/i
const nonExpenseTransactionOutcomeKeywords =
  /declined due to|was declined|failed due to|unsuccessful|reversed|reversal|refund initiated|chargeback|no amount debited/i
const approvalPromptKeywords =
  /if not you|if this wasn'?t you|approve|approval|authenticate|authorize|authorise|confirm this transaction|complete this transaction|to complete your transaction|to proceed/i
const merchantPattern = /\b(?:at|to|merchant)\s+([A-Za-z0-9&._\-/ ]{2,40})/i
const defaultCategoryLabels = new Set(
  DEFAULT_CATEGORIES.map((category) => category.label)
)
const otherCategoryLabel = "Other"

const categoryInferenceRules: Array<{ category: string; pattern: RegExp }> = [
  {
    category: "Food",
    pattern:
      /swiggy|zomato|restaurant|restro|cafe|coffee|pizza|burger|biryani|dining|eatery|bakery|food/i,
  },
  {
    category: "Transport",
    pattern:
      /uber|ola|rapido|metro|rail|train|irctc|bus|cab|taxi|petrol|diesel|fuel|parking|toll|travel/i,
  },
  {
    category: "Groceries",
    pattern:
      /grocery|groceries|supermarket|hypermarket|bigbasket|blinkit|zepto|instamart|fresh|dmart|reliance fresh/i,
  },
  {
    category: "Rent",
    pattern: /\brent\b|landlord|lease|tenancy|apartment rent|house rent/i,
  },
  {
    category: "Utilities",
    pattern:
      /electricity|water bill|utility bill|gas bill|broadband|wifi|internet bill|mobile bill|recharge|airtel|jio|vi\b|bsnl/i,
  },
  {
    category: "Entertainment",
    pattern:
      /netflix|spotify|prime video|hotstar|bookmyshow|movie|cinema|theatre|gaming|playstation|xbox/i,
  },
  {
    category: "Health",
    pattern:
      /hospital|clinic|pharmacy|medical|medicine|diagnostic|lab|apollo|practo|medplus|health/i,
  },
]

function parseAmount(body: string): number | null {
  const match = body.match(amountPattern)
  if (!match) {
    return null
  }

  const parsedAmount = Number(match[1].replace(/,/g, ""))
  return Number.isFinite(parsedAmount) ? parsedAmount : null
}

function inferPaymentMethod(body: string): PaymentMethod | undefined {
  return inferPaymentMethodFromBody(body)
}

function inferMerchant(body: string): string | undefined {
  const match = body.match(merchantPattern)
  if (!match) {
    return undefined
  }

  return match[1].replace(/\s+/g, " ").trim()
}

function normalizeSuggestedCategory(category: string): string {
  return defaultCategoryLabels.has(category) ? category : otherCategoryLabel
}

function inferCategory(body: string, merchantName?: string): string {
  const normalizedContent = `${merchantName ?? ""} ${body}`.trim().toLowerCase()
  if (normalizedContent.length === 0) {
    return otherCategoryLabel
  }

  for (const rule of categoryInferenceRules) {
    if (rule.pattern.test(normalizedContent)) {
      return normalizeSuggestedCategory(rule.category)
    }
  }

  return otherCategoryLabel
}

function isNegativeBankAlert(body: string): boolean {
  const hasDebitSignal = debitKeywords.test(body) && !creditOnlyKeywords.test(body)
  const hasSettledDebitSignal =
    settledDebitKeywords.test(body) && !creditOnlyKeywords.test(body)

  return (
    nonExpenseTransactionOutcomeKeywords.test(body) ||
    (!hasDebitSignal && nonExpenseInfoKeywords.test(body)) ||
    (approvalPromptKeywords.test(body) && !hasSettledDebitSignal)
  )
}

export function parseSmsImportCandidate(
  message: SmsImportRawMessage
): ParsedSmsImportCandidate | null {
  const body = message.body.trim()
  if (body.length === 0) {
    return null
  }

  if (otpKeywords.test(body)) {
    return null
  }

  if (isNegativeBankAlert(body)) {
    return null
  }

  if (!debitKeywords.test(body) || creditOnlyKeywords.test(body)) {
    return null
  }

  const amount = parseAmount(body)
  if (amount === null) {
    return null
  }

  const merchantName = inferMerchant(body)

  return {
    amount,
    currency: "INR",
    merchantName,
    categorySuggestion: inferCategory(body, merchantName),
    paymentMethodSuggestion: inferPaymentMethod(body),
    noteSuggestion: merchantName ? `SMS import: ${merchantName}` : undefined,
    transactionDate: message.receivedAt,
    matchedLocale: "en-IN",
    matchedPatternKey: "india.generic.transaction",
  }
}
