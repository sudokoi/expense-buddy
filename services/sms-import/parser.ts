import { PaymentMethod } from "../../types/expense"
import { SmsImportRawMessage } from "../../types/sms-import"

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
const creditOnlyKeywords = /credited|received/i
const merchantPattern = /\b(?:at|to|merchant)\s+([A-Za-z0-9&._\-/ ]{2,40})/i

function parseAmount(body: string): number | null {
  const match = body.match(amountPattern)
  if (!match) {
    return null
  }

  const parsedAmount = Number(match[1].replace(/,/g, ""))
  return Number.isFinite(parsedAmount) ? parsedAmount : null
}

function inferPaymentMethod(body: string): PaymentMethod | undefined {
  if (/\bupi\b/i.test(body)) {
    return { type: "UPI" }
  }

  if (/credit card|credit a\/c|credit acct/i.test(body)) {
    return { type: "Credit Card" }
  }

  if (/debit card|debit a\/c|debited from a\/c|debited from acct/i.test(body)) {
    return { type: "Debit Card" }
  }

  return undefined
}

function inferMerchant(body: string): string | undefined {
  const match = body.match(merchantPattern)
  if (!match) {
    return undefined
  }

  return match[1].replace(/\s+/g, " ").trim()
}

function inferCategory(merchantName?: string): string | undefined {
  if (!merchantName) {
    return undefined
  }

  const normalizedMerchant = merchantName.toLowerCase()
  if (/swiggy|zomato|cafe|restaurant|pizza|food/.test(normalizedMerchant)) {
    return "Food"
  }

  if (/uber|ola|petrol|fuel|metro|rail|travel/.test(normalizedMerchant)) {
    return "Travel"
  }

  if (/amazon|flipkart|myntra|store|mart/.test(normalizedMerchant)) {
    return "Shopping"
  }

  return undefined
}

export function parseSmsImportCandidate(
  message: SmsImportRawMessage
): ParsedSmsImportCandidate | null {
  const body = message.body.trim()
  if (body.length === 0) {
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
    categorySuggestion: inferCategory(merchantName),
    paymentMethodSuggestion: inferPaymentMethod(body),
    noteSuggestion: merchantName ? `SMS import: ${merchantName}` : undefined,
    transactionDate: message.receivedAt,
    matchedLocale: "en-IN",
    matchedPatternKey: "india.generic.transaction",
  }
}
