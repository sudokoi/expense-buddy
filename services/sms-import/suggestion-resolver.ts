import type { Category } from "../../types/category"
import type { ExpenseCategory, PaymentMethod } from "../../types/expense"
import type { PaymentInstrument } from "../../types/payment-instrument"
import type { SmsImportReviewItem } from "../../types/sms-import"
import {
  findActiveInstrumentByMethodAndLastDigits,
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

type CategoryMatchingRule = {
  contentPattern: RegExp
  categoryPattern: RegExp
}

const categoryMatchingRules: CategoryMatchingRule[] = [
  {
    contentPattern:
      /swiggy|zomato|restaurant|restro|cafe|coffee|pizza|burger|biryani|dining|eatery|bakery|food|snack|takeout/i,
    categoryPattern:
      /food|dining|restaurant|eat|meal|snack|cafe|coffee|takeout|lunch|dinner/i,
  },
  {
    contentPattern:
      /uber|ola|rapido|metro|rail|train|irctc|bus|cab|taxi|petrol|diesel|fuel|parking|toll|travel/i,
    categoryPattern:
      /transport|travel|commute|cab|taxi|fuel|petrol|diesel|parking|toll|metro|rail/i,
  },
  {
    contentPattern:
      /grocery|groceries|supermarket|hypermarket|bigbasket|blinkit|zepto|instamart|fresh|dmart|reliance fresh/i,
    categoryPattern: /grocery|grocer|supermarket|market|mart|provision|essentials/i,
  },
  {
    contentPattern: /\brent\b|landlord|lease|tenancy|apartment rent|house rent/i,
    categoryPattern: /rent|housing|house|home|lease|tenancy|apartment/i,
  },
  {
    contentPattern:
      /electricity|water bill|utility bill|gas bill|broadband|wifi|internet bill|mobile bill|recharge|airtel|jio|vi\b|bsnl/i,
    categoryPattern:
      /utilit|bill|electric|water|gas|internet|broadband|wifi|mobile|recharge|phone/i,
  },
  {
    contentPattern:
      /netflix|spotify|prime video|hotstar|bookmyshow|movie|cinema|theatre|gaming|playstation|xbox/i,
    categoryPattern:
      /entertain|movie|cinema|theatre|music|game|gaming|stream|subscription/i,
  },
  {
    contentPattern:
      /hospital|clinic|pharmacy|medical|medicine|diagnostic|lab|apollo|practo|medplus|health/i,
    categoryPattern: /health|medical|medicine|pharmacy|clinic|doctor|hospital|wellness/i,
  },
]

const maskedDigitsPattern =
  /(?:card|a\/c|acct|account)[^0-9]{0,12}(?:x+|\*+)?\s*(\d{3,4})\b/gi

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildItemContent(item: SmsImportReviewItem): string {
  return [
    item.merchantName,
    item.noteSuggestion,
    item.sourceMessage.sender,
    item.sourceMessage.body,
  ]
    .filter((value): value is string => !!value)
    .join(" ")
    .toLowerCase()
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

function extractIdentifierFromBody(
  body: string,
  expectedLength: 3 | 4
): string | undefined {
  const candidates = [...body.matchAll(maskedDigitsPattern)]

  for (const candidate of candidates) {
    const digits = candidate[1]?.replace(/\D/g, "")
    if (digits && digits.length >= expectedLength) {
      return digits.slice(-expectedLength)
    }
  }

  return undefined
}

function bodyHintsMethod(body: string, type: PaymentMethod["type"]): boolean {
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

function bodyContainsInstrumentDigits(body: string, lastDigits: string): boolean {
  const exactPattern = new RegExp(`(?:^|\\D)${escapeRegExp(lastDigits)}(?!\\d)`, "i")
  const maskedPattern = new RegExp(
    `(?:x|\\*)+\\s*${escapeRegExp(lastDigits)}(?!\\d)`,
    "i"
  )
  return exactPattern.test(body) || maskedPattern.test(body)
}

export function resolveSmsImportCategory(
  item: SmsImportReviewItem,
  availableCategories: Category[]
): ExpenseCategory {
  const labels = new Set(availableCategories.map((category) => category.label))

  if (item.categorySuggestion && labels.has(item.categorySuggestion)) {
    return item.categorySuggestion
  }

  const itemContent = buildItemContent(item)

  const directMatch = tryDirectCategoryLabelMatch(itemContent, availableCategories)
  if (directMatch) {
    return directMatch
  }

  for (const rule of categoryMatchingRules) {
    if (!rule.contentPattern.test(itemContent)) {
      continue
    }

    const matchedCategory = availableCategories.find((category) =>
      rule.categoryPattern.test(category.label)
    )

    if (matchedCategory) {
      return matchedCategory.label
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
  const body = item.sourceMessage.body
  const baseSuggestion = item.paymentMethodSuggestion
  const activeInstruments = getActivePaymentInstruments(paymentInstruments)

  if (baseSuggestion?.type && isPaymentInstrumentMethod(baseSuggestion.type)) {
    const identifier =
      baseSuggestion.identifier ??
      extractIdentifierFromBody(body, baseSuggestion.type === "UPI" ? 3 : 4)

    if (identifier) {
      const matchedInstrument = findActiveInstrumentByMethodAndLastDigits(
        activeInstruments,
        baseSuggestion.type,
        identifier
      )

      if (matchedInstrument) {
        return {
          type: baseSuggestion.type,
          identifier: matchedInstrument.lastDigits,
          instrumentId: matchedInstrument.id,
        }
      }

      return {
        ...baseSuggestion,
        identifier,
      }
    }
  }

  const nicknameMatches = activeInstruments.filter((instrument) => {
    if (baseSuggestion?.type && instrument.method !== baseSuggestion.type) {
      return false
    }

    if (!baseSuggestion?.type && !bodyHintsMethod(body, instrument.method)) {
      return false
    }

    return bodyContainsInstrumentNickname(body, instrument.nickname)
  })

  if (nicknameMatches.length === 1) {
    const matchedInstrument = nicknameMatches[0]
    return {
      type: matchedInstrument.method,
      identifier: matchedInstrument.lastDigits,
      instrumentId: matchedInstrument.id,
    }
  }

  const matchingInstruments = activeInstruments.filter((instrument) => {
    if (!bodyContainsInstrumentDigits(body, instrument.lastDigits)) {
      return false
    }

    if (baseSuggestion?.type && instrument.method === baseSuggestion.type) {
      return true
    }

    return bodyHintsMethod(body, instrument.method)
  })

  if (matchingInstruments.length === 1) {
    const matchedInstrument = matchingInstruments[0]
    return {
      type: matchedInstrument.method,
      identifier: matchedInstrument.lastDigits,
      instrumentId: matchedInstrument.id,
    }
  }

  return baseSuggestion
}
