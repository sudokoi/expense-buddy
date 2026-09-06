import type { Category } from "../../types/category"
import type { ExpenseCategory, PaymentMethod } from "../../types/expense"
import type { PaymentInstrument } from "../../types/payment-instrument"
import type { SmsImportReviewItem } from "../../types/sms-import"
import {
  getActivePaymentInstruments,
  isPaymentInstrumentMethod,
  normalizeNickname,
} from "../payment-instruments"
import {
  hasCardBrandHint,
  hasCreditCardHint,
  hasDebitCardHint,
  hasUpiHint,
} from "./payment-method-hints"
import { getReviewEvidence } from "./review-evidence"

type CategoryMatchingRule = {
  nativeCategory: string
  contentPattern: RegExp
  categoryPattern: RegExp
}

const categoryMatchingRules: CategoryMatchingRule[] = [
  {
    nativeCategory: "Food",
    contentPattern:
      /swiggy|zomato|restaurant|restro|cafe|coffee|pizza|burger|biryani|dining|eatery|bakery|food|snack|takeout/i,
    categoryPattern:
      /food|dining|restaurant|eat|meal|snack|cafe|coffee|takeout|lunch|dinner/i,
  },
  {
    nativeCategory: "Transport",
    contentPattern:
      /uber|ola|rapido|metro|rail|train|irctc|bus|cab|taxi|petrol|diesel|fuel|parking|toll|travel/i,
    categoryPattern:
      /transport|travel|commute|cab|taxi|fuel|petrol|diesel|parking|toll|metro|rail/i,
  },
  {
    nativeCategory: "Groceries",
    contentPattern:
      /grocery|groceries|supermarket|hypermarket|bigbasket|blinkit|zepto|instamart|fresh|dmart|reliance fresh/i,
    categoryPattern: /grocery|grocer|supermarket|market|mart|provision|essentials/i,
  },
  {
    nativeCategory: "Rent",
    contentPattern: /\brent\b|landlord|lease|tenancy|apartment rent|house rent/i,
    categoryPattern: /rent|housing|house|home|lease|tenancy|apartment/i,
  },
  {
    nativeCategory: "Utilities",
    contentPattern:
      /electricity|water bill|utility bill|gas bill|broadband|wifi|internet bill|mobile bill|recharge|airtel|jio|vi\b|bsnl/i,
    categoryPattern:
      /utilit|bill|electric|water|gas|internet|broadband|wifi|mobile|recharge|phone/i,
  },
  {
    nativeCategory: "Entertainment",
    contentPattern:
      /netflix|spotify|prime video|hotstar|bookmyshow|movie|cinema|theatre|gaming|playstation|xbox/i,
    categoryPattern:
      /entertain|movie|cinema|theatre|music|game|gaming|stream|subscription/i,
  },
  {
    nativeCategory: "Health",
    contentPattern:
      /hospital|clinic|pharmacy|medical|medicine|diagnostic|lab|apollo|practo|medplus|health/i,
    categoryPattern: /health|medical|medicine|pharmacy|clinic|doctor|hospital|wellness/i,
  },
]

// Apply Latin token boundaries without imposing English segmentation on CJK.
const boundedCategoryRules = categoryMatchingRules.map((rule) => ({
  ...rule,
  contentPattern: new RegExp(
    `(?:^|[^a-z])(?:${rule.contentPattern.source})(?![a-z])`,
    "i"
  ),
}))

const maskedDigitsPattern =
  /(?:\b(?:card|visa|mastercard|amex|rupay|maestro|discover|jcb|a\/c|acct|account)\b|カード|口座)\s*(?:(?:ending|ends)(?: with| in)?\s*|末尾\s*)?(?:x+|\*+)?\s*(\d{3,4})(?!\d)/gi

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function tryDirectCategoryLabelMatch(
  itemContent: string,
  availableCategories: Category[]
): ExpenseCategory | undefined {
  for (const category of availableCategories) {
    const normalizedLabel = category.label.trim().toLowerCase()
    if (normalizedLabel.length < 3) {
      continue
    }

    const directPattern = new RegExp(`\\b${escapeRegExp(normalizedLabel)}\\b`, "i")
    if (directPattern.test(itemContent)) {
      return category.label
    }
  }

  return undefined
}

function extractIdentifiersFromBody(body: string, expectedLength: 3 | 4): string[] {
  const candidates = [...body.matchAll(maskedDigitsPattern)]
  const identifiers = new Set<string>()

  for (const candidate of candidates) {
    const isAccount = /^(?:a\/c|acct|account|口座)/i.test(candidate[0])
    if ((expectedLength === 3) !== isAccount) continue
    const digits = candidate[1]?.replace(/\D/g, "")
    if (digits && digits.length >= expectedLength) {
      identifiers.add(digits.slice(-expectedLength))
    }
  }

  return [...identifiers]
}

function bodyHintsMethod(body: string, type: PaymentMethod["type"]): boolean {
  if (type === "Credit Card" && hasDebitCardHint(body)) return false
  if (type === "Debit Card" && hasCreditCardHint(body)) return false
  switch (type) {
    case "UPI":
      return hasUpiHint(body)
    case "Credit Card":
      return hasCreditCardHint(body) || hasCardBrandHint(body) || /card/i.test(body)
    case "Debit Card":
      return hasDebitCardHint(body) || hasCardBrandHint(body) || /card/i.test(body)
    default:
      return false
  }
}

function bodyContainsInstrumentNickname(body: string, nickname: string): boolean {
  const normalizedNickname = normalizeNickname(nickname)
  if (normalizedNickname.length < 4) {
    return false
  }

  const nicknamePattern = new RegExp(
    `\\b${normalizedNickname
      .split(/\s+/)
      .map((part) => escapeRegExp(part))
      .join("\\s+")}\\b`,
    "i"
  )

  return nicknamePattern.test(body)
}

export function resolveSmsImportCategory(
  item: SmsImportReviewItem,
  availableCategories: Category[]
): ExpenseCategory {
  const labels = new Set(availableCategories.map((category) => category.label))

  if (
    item.categorySuggestion &&
    item.categorySuggestion !== "Other" &&
    labels.has(item.categorySuggestion)
  ) {
    return item.categorySuggestion
  }

  const nativeRule = boundedCategoryRules.find(
    (rule) => rule.nativeCategory === item.categorySuggestion
  )
  const semanticMatch =
    nativeRule &&
    availableCategories.find((category) =>
      nativeRule.categoryPattern.test(category.label)
    )
  if (semanticMatch) return semanticMatch.label

  for (const content of [item.merchantName, getReviewEvidence(item).description]) {
    if (!content) continue
    const directMatch = tryDirectCategoryLabelMatch(content, availableCategories)
    if (directMatch) return directMatch
    const ranked = boundedCategoryRules
      .map((rule, order) => ({
        rule,
        order,
        length: Math.max(
          0,
          ...Array.from(
            content.matchAll(new RegExp(rule.contentPattern.source, "gi")),
            (match) => match[0].length
          )
        ),
      }))
      .filter((match) => match.length > 0)
      .sort((a, b) => b.length - a.length || a.order - b.order)
    for (const { rule } of ranked) {
      const category = availableCategories.find((entry) =>
        rule.categoryPattern.test(entry.label)
      )
      if (category) return category.label
    }
  }

  if (labels.has("Other")) {
    return "Other"
  }

  return availableCategories[0]?.label ?? "Other"
}

export function resolveSmsImportPaymentSuggestion(
  item: SmsImportReviewItem,
  paymentInstruments: PaymentInstrument[]
): PaymentMethod | undefined {
  const body = getReviewEvidence(item).payer
  const baseSuggestion = item.paymentMethodSuggestion
  if (baseSuggestion?.instrumentId) return baseSuggestion
  const activeInstruments = getActivePaymentInstruments(paymentInstruments)
  if (baseSuggestion && !isPaymentInstrumentMethod(baseSuggestion.type))
    return baseSuggestion
  const eligible = activeInstruments.filter((instrument) =>
    baseSuggestion
      ? instrument.method === baseSuggestion.type
      : bodyHintsMethod(body, instrument.method)
  )
  const identifiers = baseSuggestion?.identifier
    ? [baseSuggestion.identifier]
    : baseSuggestion?.type === "UPI" || (!baseSuggestion && hasUpiHint(body))
      ? extractIdentifiersFromBody(body, 3)
      : extractIdentifiersFromBody(body, 4)
  if (identifiers.length > 1) return baseSuggestion
  const identifier = identifiers[0]
  const matchingInstruments = identifier
    ? eligible.filter((instrument) => instrument.lastDigits === identifier)
    : eligible.filter((instrument) =>
        bodyContainsInstrumentNickname(body, instrument.nickname)
      )
  if (matchingInstruments.length === 1) {
    const matchedInstrument = matchingInstruments[0]
    return {
      type: matchedInstrument.method,
      identifier: matchedInstrument.lastDigits,
      instrumentId: matchedInstrument.id,
    }
  }

  return baseSuggestion && identifier ? { ...baseSuggestion, identifier } : baseSuggestion
}
